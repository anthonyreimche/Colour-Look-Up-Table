/*
    The reference for the Colour Look Up Table extension's tests: darktable's
    own code for its "color look up table" module, compiled with gcc.

    Everything between the "darktable" markers below is copied verbatim from
    darktable 5.6.1 (tag release-5.6.1):
      src/iop/colorchecker.c        Copyright (C) 2016-2026 darktable developers.
      src/iop/gaussian_elimination.h Copyright (C) 2017-2023 darktable developers.
      src/common/math.h (fastlog2, fastlog)
                                    Copyright (C) 2009-2026 darktable developers.
    darktable is free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by the
    Free Software Foundation, either version 3 of the License, or (at your
    option) any later version.

    The rest is a shim standing in for darktable's headers, and a driver that
    prints the solved coefficients and the module's output for a grid of Lab
    colours, for the hand-written cases and every built-in preset, as JSON.

    Regenerate test/reference/vectors.json with `node test/reference/build.cjs`.
*/

#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TRUE 1
#define FALSE 0
#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define M_LN2f 0.69314718055994530942f
#define DT_OMP_DECLARE_SIMD(...)
#define DT_OMP_FOR(...)
#define DT_IS_ALIGNED(p) (p)
#define _(s) (s)
#define DEVELOP_BLEND_CS_RGB_DISPLAY 0
#define for_each_channel(c) for(int c = 0; c < 4; c++)
#define dt_alloc_align_type(type, n) ((type *)calloc((n), sizeof(type)))
#define dt_free_align(p) free(p)
#define copy_pixel(dst, src) memcpy((dst), (src), 4 * sizeof(float))
#define copy_pixel_nontemporal(dst, src) memcpy((dst), (src), 4 * sizeof(float))
#define dt_omploop_sfence()

typedef float dt_aligned_pixel_t[4];

/* ── darktable: src/common/math.h ─────────────────────────────────────── */
static inline float fastlog2(const float x)
{
  const union { float f; uint32_t i; } vx = { x };
  const union { uint32_t i; float f; } mx = { (vx.i & 0x007FFFFF) | 0x3f000000 };

  float y = vx.i;

  y *= 1.1920928955078125e-7f;

  return y - 124.22551499f
    - 1.498030302f * mx.f
    - 1.72587999f / (0.3520887068f + mx.f);
}

// ensure that any changes here are synchronized with data/kernels/extended.cl
static inline float fastlog(const float x)
{
  return M_LN2f * fastlog2(x);
}
/* ── end darktable ─────────────────────────────────────────────────────── */

static inline float sqf(const float x) { return x * x; }

/* dt_exif_xmp_decode for the plain hex its presets use. */
static uint8_t *dt_exif_xmp_decode(const char *input, const int len, int *output_len)
{
  uint8_t *out = malloc(len / 2);
  for(int i = 0; i < len / 2; i++)
  {
    unsigned v;
    sscanf(input + 2 * i, "%2x", &v);
    out[i] = (uint8_t)v;
  }
  *output_len = len / 2;
  return out;
}

/* ── darktable: src/iop/gaussian_elimination.h (gauss_make_triangular, gauss_solve_triangular, gauss_solve) ── */
// Gaussian elimination with partial vivoting
// after function call the square matrix A is triangular
// vector p keeps track of row swaps
// returns 0 if matrix A is singular
// matrix elements are stored in row-major order
static int gauss_make_triangular(double *A, int *p, int n)
{
  p[n - 1] = n - 1; // we never swap from the last row
  for(int k = 0; k < n; ++k)
  {
    // find pivot element for row swap
    int m = k;
    for(int i = k + 1; i < n; ++i)
      if(fabs(A[k + n * i]) > fabs(A[k + n * m])) m = i;
    p[k] = m; // rows k and m are swapped
    // eliminate elements and swap rows
    double t1 = A[k + n * m];
    A[k + n * m] = A[k + n * k];
    A[k + n * k] = t1; // new diagonal elements are (implicitly) one, store scaling factors on diagonal
    if(t1 != 0)
    {
      for(int i = k + 1; i < n; ++i) A[k + n * i] /= -t1;
      // swap rows
      if(k != m)
        for(int i = k + 1; i < n; ++i)
        {
          double t2 = A[i + n * m];
          A[i + n * m] = A[i + n * k];
          A[i + n * k] = t2;
        }
      for(int j = k + 1; j < n; ++j)
        for(int i = k + 1; i < n; ++i) A[i + n * j] += A[k + j * n] * A[i + k * n];
    }
    else
      // the matrix is singular
      return 0;
  }
  return 1;
}

// backward substritution after Gaussian elimination
static void gauss_solve_triangular(const double *A, const int *p, double *b, int n)
{
  // permute and rescale elements of right-hand-side
  for(int k = 0; k < n - 1; ++k)
  {
    int m = p[k];
    double t = b[m];
    b[m] = b[k];
    b[k] = t;
    for(int i = k + 1; i < n; ++i) b[i] += A[k + n * i] * t;
  }
  // perform backward substritution
  for(int k = n - 1; k > 0; --k)
  {
    b[k] /= A[k + n * k];
    double t = b[k];
    for(int i = 0; i < k; ++i) b[i] -= A[k + n * i] * t;
  }
  b[0] /= A[0 + 0 * n];
}

static int gauss_solve(double *A, double *b, int n)
{
  int *p = malloc(n * sizeof(*p));
  int err_code = 1;
  if((err_code = gauss_make_triangular(A, p, n))) gauss_solve_triangular(A, p, b, n);
  free(p);
  return err_code;
}
/* ── end darktable ── */

/* darktable's module and pipe types, as far as the copied code reads them. */
typedef struct dt_iop_module_t dt_iop_module_t;
typedef void dt_iop_params_t;
typedef struct dt_dev_pixelpipe_t dt_dev_pixelpipe_t;
typedef struct { void *data; int colors; } dt_dev_pixelpipe_iop_t;
typedef struct { int width, height; } dt_iop_roi_t;
typedef struct { const char *op; int (*version)(void); } dt_iop_module_so_t;
static int version(void) { return 2; }
#define dt_iop_have_required_input_format(...) 1
#define dt_gui_presets_add_generic(name, op, ver, params, size, a, b) record_preset(name, params, size)
static void record_preset(const char *name, const void *params, const int size);

/* ── darktable: src/iop/colorchecker.c ─────────────────────────────── */
static const int colorchecker_patches = 24;
static const float colorchecker_Lab[] =
{ // from argyll ColorChecker.cie
 37.99,   13.56,  14.06, // dark skin
 65.71,   18.13,  17.81, // light skin
 49.93,   -4.88, -21.93, // blue sky
 43.14,  -13.10,  21.91, // foliage
 55.11,    8.84, -25.40, // blue flower
 70.72,  -33.40, -0.20 , // bluish green
 62.66,   36.07,  57.10, // orange
 40.02,   10.41, -45.96, // purple red
 51.12,   48.24,  16.25, // moderate red
 30.33,   22.98, -21.59, // purple
 72.53,  -23.71,  57.26, // yellow green
 71.94,  19.36 ,  67.86, // orange yellow
 28.78,  14.18 , -50.30, // blue
 55.26,  -38.34,  31.37, // green
 42.10,  53.38 ,  28.19, // red
 81.73,  4.04  ,  79.82, // yellow
 51.94,  49.99 , -14.57, // magenta
 51.04,  -28.63, -28.64, // cyan
 96.54,  -0.43 ,  1.19 , // white
 81.26,  -0.64 , -0.34 , // neutral 8
 66.77,  -0.73 , -0.50 , // neutral 65
 50.87,  -0.15 , -0.27 , // neutral 5
 35.66,  -0.42 , -1.23 , // neutral 35
 20.46,  -0.08 , -0.97   // black
};

// we came to the conclusion that more than 7x7 patches will not be
// manageable in the gui. the fitting experiments show however that you
// can do significantly better with 49 than you can with 24 patches,
// especially when considering max delta E.
#define MAX_PATCHES 49
typedef struct dt_iop_colorchecker_params_t
{
  float source_L[MAX_PATCHES];
  float source_a[MAX_PATCHES];
  float source_b[MAX_PATCHES];
  float target_L[MAX_PATCHES];
  float target_a[MAX_PATCHES];
  float target_b[MAX_PATCHES];
  int32_t num_patches;
} dt_iop_colorchecker_params_t;

typedef struct dt_iop_colorchecker_data_t
{
  int32_t num_patches;
  float source_Lab[3*MAX_PATCHES];
  float coeff_L[MAX_PATCHES+4];
  float coeff_a[MAX_PATCHES+4];
  float coeff_b[MAX_PATCHES+4];
} dt_iop_colorchecker_data_t;

void init_presets(dt_iop_module_so_t *self)
{
  dt_iop_colorchecker_params_t p;
  memset(&p, 0, sizeof(p));
  p.num_patches = 24;
  p.target_L[ 0] = p.source_L[ 0] = 17.460945129394531;
  p.target_L[ 1] = p.source_L[ 1] = 26.878498077392578;
  p.target_L[ 2] = p.source_L[ 2] = 34.900054931640625;
  p.target_L[ 3] = p.source_L[ 3] = 21.692604064941406;
  p.target_L[ 4] = p.source_L[ 4] = 32.18853759765625;
  p.target_L[ 5] = p.source_L[ 5] = 62.531227111816406;
  p.target_L[ 6] = p.source_L[ 6] = 18.933284759521484;
  p.target_L[ 7] = p.source_L[ 7] = 53.936111450195312;
  p.target_L[ 8] = p.source_L[ 8] = 69.154266357421875;
  p.target_L[ 9] = p.source_L[ 9] = 43.381229400634766;
  p.target_L[10] = p.source_L[10] = 57.797889709472656;
  p.target_L[11] = p.source_L[11] = 73.27630615234375;
  p.target_L[12] = p.source_L[12] = 53.175498962402344;
  p.target_L[13] = p.source_L[13] = 49.111373901367188;
  p.target_L[14] = p.source_L[14] = 63.169830322265625;
  p.target_L[15] = p.source_L[15] = 61.896102905273438;
  p.target_L[16] = p.source_L[16] = 67.852409362792969;
  p.target_L[17] = p.source_L[17] = 72.489517211914062;
  p.target_L[18] = p.source_L[18] = 70.935714721679688;
  p.target_L[19] = p.source_L[19] = 70.173004150390625;
  p.target_L[20] = p.source_L[20] = 77.78826904296875;
  p.target_L[21] = p.source_L[21] = 76.070747375488281;
  p.target_L[22] = p.source_L[22] = 68.645004272460938;
  p.target_L[23] = p.source_L[23] = 74.502906799316406;
  p.target_a[ 0] = p.source_a[ 0] = 8.4928874969482422;
  p.target_a[ 1] = p.source_a[ 1] = 27.94782829284668;
  p.target_a[ 2] = p.source_a[ 2] = 43.8824462890625;
  p.target_a[ 3] = p.source_a[ 3] = 16.723676681518555;
  p.target_a[ 4] = p.source_a[ 4] = 39.174972534179688;
  p.target_a[ 5] = p.source_a[ 5] = 24.966419219970703;
  p.target_a[ 6] = p.source_a[ 6] = 8.8226642608642578;
  p.target_a[ 7] = p.source_a[ 7] = 34.451812744140625;
  p.target_a[ 8] = p.source_a[ 8] = 18.39008903503418;
  p.target_a[ 9] = p.source_a[ 9] = 28.272598266601562;
  p.target_a[10] = p.source_a[10] = 10.193824768066406;
  p.target_a[11] = p.source_a[11] = 13.241470336914062;
  p.target_a[12] = p.source_a[12] = 43.655307769775391;
  p.target_a[13] = p.source_a[13] = 23.247600555419922;
  p.target_a[14] = p.source_a[14] = 23.308664321899414;
  p.target_a[15] = p.source_a[15] = 11.138319969177246;
  p.target_a[16] = p.source_a[16] = 18.200069427490234;
  p.target_a[17] = p.source_a[17] = 15.363990783691406;
  p.target_a[18] = p.source_a[18] = 11.173545837402344;
  p.target_a[19] = p.source_a[19] = 11.313735961914062;
  p.target_a[20] = p.source_a[20] = 15.059500694274902;
  p.target_a[21] = p.source_a[21] = 4.7686996459960938;
  p.target_a[22] = p.source_a[22] = 3.0603706836700439;
  p.target_a[23] = p.source_a[23] = -3.687053918838501;
  p.target_b[ 0] = p.source_b[ 0] = -0.023579597473144531;
  p.target_b[ 1] = p.source_b[ 1] = 14.991056442260742;
  p.target_b[ 2] = p.source_b[ 2] = 26.443553924560547;
  p.target_b[ 3] = p.source_b[ 3] = 7.3905587196350098;
  p.target_b[ 4] = p.source_b[ 4] = 23.309671401977539;
  p.target_b[ 5] = p.source_b[ 5] = 19.262432098388672;
  p.target_b[ 6] = p.source_b[ 6] = 3.136211633682251;
  p.target_b[ 7] = p.source_b[ 7] = 31.949621200561523;
  p.target_b[ 8] = p.source_b[ 8] = 16.144514083862305;
  p.target_b[ 9] = p.source_b[ 9] = 25.893926620483398;
  p.target_b[10] = p.source_b[10] = 12.271202087402344;
  p.target_b[11] = p.source_b[11] = 16.763805389404297;
  p.target_b[12] = p.source_b[12] = 53.904998779296875;
  p.target_b[13] = p.source_b[13] = 36.537342071533203;
  p.target_b[14] = p.source_b[14] = 32.930683135986328;
  p.target_b[15] = p.source_b[15] = 19.008804321289062;
  p.target_b[16] = p.source_b[16] = 32.259223937988281;
  p.target_b[17] = p.source_b[17] = 25.815582275390625;
  p.target_b[18] = p.source_b[18] = 26.509498596191406;
  p.target_b[19] = p.source_b[19] = 40.572704315185547;
  p.target_b[20] = p.source_b[20] = 88.354469299316406;
  p.target_b[21] = p.source_b[21] = 33.434604644775391;
  p.target_b[22] = p.source_b[22] = 9.5750093460083008;
  p.target_b[23] = p.source_b[23] = 41.285167694091797;
  dt_gui_presets_add_generic(_("it8 skin tones"), self->op,
                             self->version(), &p, sizeof(p),
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);

  memset(&p, 0, sizeof(p));
  p.num_patches = 49;
  // red ramp in first row
  p.target_L[0] = p.source_L[0] = 10;
  p.target_L[1] = p.source_L[1] = 20;
  p.target_L[2] = p.source_L[2] = 30;
  p.target_L[3] = p.source_L[3] = 50;
  p.target_L[4] = p.source_L[4] = 70;
  p.target_L[5] = p.source_L[5] = 80;
  p.target_L[6] = p.source_L[6] = 90;
  p.target_a[0] = p.source_a[0] = 48;
  p.target_a[1] = p.source_a[1] = 72;
  p.target_a[2] = p.source_a[2] = 72;
  p.target_a[3] = p.source_a[3] = 72;
  p.target_a[4] = p.source_a[4] = 72;
  p.target_a[5] = p.source_a[5] = 72;
  p.target_a[6] = p.source_a[6] = 72;
  p.target_b[0] = p.source_b[0] = 16;
  p.target_b[1] = p.source_b[1] = 24;
  p.target_b[2] = p.source_b[2] = 24;
  p.target_b[3] = p.source_b[3] = 24;
  p.target_b[4] = p.source_b[4] = 24;
  p.target_b[5] = p.source_b[5] = 24;
  p.target_b[6] = p.source_b[6] = 24;

  // blue ramp in second row
  p.target_L[ 7] = p.source_L[ 7] = 10;
  p.target_L[ 8] = p.source_L[ 8] = 20;
  p.target_L[ 9] = p.source_L[ 9] = 30;
  p.target_L[10] = p.source_L[10] = 50;
  p.target_L[11] = p.source_L[11] = 70;
  p.target_L[12] = p.source_L[12] = 80;
  p.target_L[13] = p.source_L[13] = 90;
  p.target_a[ 7] = p.source_a[ 7] = 7;
  p.target_a[ 8] = p.source_a[ 8] = 14;
  p.target_a[ 9] = p.source_a[ 9] = 21;
  p.target_a[10] = p.source_a[10] = 21;
  p.target_a[11] = p.source_a[11] = 21;
  p.target_a[12] = p.source_a[12] = 21;
  p.target_a[13] = p.source_a[13] = 14;
  p.target_b[ 7] = p.source_b[ 7] = -25;
  p.target_b[ 8] = p.source_b[ 8] = -50;
  p.target_b[ 9] = p.source_b[ 9] = -75;
  p.target_b[10] = p.source_b[10] = -75;
  p.target_b[11] = p.source_b[11] = -75;
  p.target_b[12] = p.source_b[12] = -75;
  p.target_b[13] = p.source_b[13] = -50;

  // green ramp in third row
  p.target_L[14] = p.source_L[14] = 10;
  p.target_L[15] = p.source_L[15] = 20;
  p.target_L[16] = p.source_L[16] = 30;
  p.target_L[17] = p.source_L[17] = 50;
  p.target_L[18] = p.source_L[18] = 70;
  p.target_L[19] = p.source_L[19] = 80;
  p.target_L[20] = p.source_L[20] = 90;
  p.target_a[14] = p.source_a[14] = -20;
  p.target_a[15] = p.source_a[15] = -40;
  p.target_a[16] = p.source_a[16] = -40;
  p.target_a[17] = p.source_a[17] = -40;
  p.target_a[18] = p.source_a[18] = -40;
  p.target_a[19] = p.source_a[19] = -40;
  p.target_a[20] = p.source_a[20] = -40;
  p.target_b[14] = p.source_b[14] = 16;
  p.target_b[15] = p.source_b[15] = 32;
  p.target_b[16] = p.source_b[16] = 32;
  p.target_b[17] = p.source_b[17] = 32;
  p.target_b[18] = p.source_b[18] = 32;
  p.target_b[19] = p.source_b[19] = 32;
  p.target_b[20] = p.source_b[20] = 32;

  // orange/yellow/cyan tones in fourth row
  p.target_L[21] = p.source_L[21] = 63;	// orange
  p.target_a[21] = p.source_a[21] = 36;
  p.target_b[21] = p.source_b[21] = 57;
  p.target_L[22] = p.source_L[22] = 72; // orange yellow
  p.target_a[22] = p.source_a[22] = 19;
  p.target_b[22] = p.source_b[22] = 68;
  p.target_L[23] = p.source_L[23] = 82; // yellow
  p.target_a[23] = p.source_a[23] =  4;
  p.target_b[23] = p.source_b[23] = 80;
  p.target_L[24] = p.source_L[24] = 72; // yellow green
  p.target_a[24] = p.source_a[24] = -24;
  p.target_b[24] = p.source_b[24] = 57;
  p.target_L[25] = p.source_L[25] = 43; // foliage
  p.target_a[25] = p.source_a[25] = -13;
  p.target_b[25] = p.source_b[25] = 22;
  p.target_L[26] = p.source_L[26] = 71; // bluish green
  p.target_a[26] = p.source_a[26] = -33;
  p.target_b[26] = p.source_b[26] = 0;
  p.target_L[27] = p.source_L[27] = 51; // cyan
  p.target_a[27] = p.source_a[27] = -60;
  p.target_b[27] = p.source_b[27] = -60;

  // fifth row: CC24-like skin tone and misc patches
  p.target_L[28] = p.source_L[28] = 39;  // CC24 dark skin
  p.target_a[28] = p.source_a[28] = 14;
  p.target_b[28] = p.source_b[28] = 14;
  p.target_L[29] = p.source_L[29] = 65;  // CC24 light skin
  p.target_a[29] = p.source_a[29] = 19;
  p.target_b[29] = p.source_b[29] = 17;
  p.target_L[30] = p.source_L[30] = 49;  // blue sky
  p.target_a[30] = p.source_a[30] = -4;
  p.target_b[30] = p.source_b[30] = -23;
  p.target_L[31] = p.source_L[31] = 55;  // blue flower
  p.target_a[31] = p.source_a[31] =  9;
  p.target_b[31] = p.source_b[31] = -25;
  p.target_L[32] = p.source_L[32] = 52;  // magenta
  p.target_a[32] = p.source_a[32] = 75;
  p.target_b[32] = p.source_b[32] = -21;
  p.target_L[33] = p.source_L[33] = 31;  // purple
  p.target_a[33] = p.source_a[33] = 50;
  p.target_b[33] = p.source_b[33] = -50;
  p.target_L[34] = p.source_L[34] = 41;  // purple red
  p.target_a[34] = p.source_a[34] = 33;
  p.target_b[34] = p.source_b[34] = -66;

  // IT8 skin tones in sixth row
  p.target_L[35] = p.source_L[35] = 17;
  p.target_a[35] = p.source_a[35] = 8;
  p.target_b[35] = p.source_b[35] = 0;
  p.target_L[36] = p.source_L[36] = 30;
  p.target_a[36] = p.source_a[36] = 9;
  p.target_b[36] = p.source_b[36] = 3;
  p.target_L[37] = p.source_L[37] = 26;
  p.target_a[37] = p.source_a[37] = 28;
  p.target_b[37] = p.source_b[37] = 15;
  p.target_L[38] = p.source_L[38] = 32;
  p.target_a[38] = p.source_a[38] = 39;
  p.target_b[38] = p.source_b[38] = 23;
  p.target_L[39] = p.source_L[39] = 54;
  p.target_a[39] = p.source_a[39] = 34;
  p.target_b[39] = p.source_b[39] = 32;
  p.target_L[40] = p.source_L[40] = 70;
  p.target_a[40] = p.source_a[40] = 11;
  p.target_b[40] = p.source_b[40] = 41;
  p.target_L[41] = p.source_L[41] = 76;
  p.target_a[41] = p.source_a[41] = 5;
  p.target_b[41] = p.source_b[41] = 33;

  // 7-level gray ramp in last row
  p.target_L[42] = p.source_L[42] = 2.0;
  p.target_L[43] = p.source_L[43] = 18.0;
  p.target_L[44] = p.source_L[44] = 34.0;
  p.target_L[45] = p.source_L[45] = 50.0;
  p.target_L[46] = p.source_L[46] = 66.0;
  p.target_L[47] = p.source_L[47] = 82.0;
  p.target_L[48] = p.source_L[48] = 98.0;
  p.target_a[42] = p.source_a[42] = 0.0;
  p.target_a[43] = p.source_a[43] = 0.0;
  p.target_a[44] = p.source_a[44] = 0.0;
  p.target_a[45] = p.source_a[45] = 0.0;
  p.target_a[46] = p.source_a[46] = 0.0;
  p.target_a[47] = p.source_a[47] = 0.0;
  p.target_a[48] = p.source_a[48] = 0.0;
  p.target_b[42] = p.source_b[42] = 0.0;
  p.target_b[43] = p.source_b[43] = 0.0;
  p.target_b[44] = p.source_b[44] = 0.0;
  p.target_b[45] = p.source_b[45] = 0.0;
  p.target_b[46] = p.source_b[46] = 0.0;
  p.target_b[47] = p.source_b[47] = 0.0;
  p.target_b[48] = p.source_b[48] = 0.0;
  dt_gui_presets_add_generic(_("expanded color checker"), self->op,
                             self->version(), &p, sizeof(p),
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);

  // Helmholtz/Kohlrausch effect applied to black and white conversion.
  // implemented by wmader as an iop and matched as a clut for increased
  // flexibility. this was done using darktable-chart and this is copied
  // from the resulting dtstyle output file:
  const char *hk_params_input =
    "9738b84231c098426fb8814234a82d422ac41d422e3fa04100004843f7daa24257e09a422a1a984225113842f89cc9410836ca4295049542ad1c9242887370427cb32b427c512242b5a40742545bd141808740412cc6964262e484429604c44100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ef6d3bc152c2acc1ef6566c093a522c2e7d4e4c1a87c7cc100000000b4c4dd407af09e40d060df418afc7d421dadd0413ec5124097d79041fcba2642fc9f484183eb92415d6b7040fcdcdc41b8fe2f42b64a1740fc8612c1276defc144432ec100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d237eb4022a72842f5639742396d1442a2660d411c338b40000000006e35ca408df2054289658d4132327a4118427741d4cf08c0f8a4d5c03abed7c13fac36c23b41a6c03c2230c07d5088c26caff7c1e0e9c6bff14ecec073b028c29e0accc10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000085f2b642a4ba9a423c9a8442a6493c428baf28425667b64100004843a836a142a84e9b4226719d421cb15d424c22ee4175fcca4211ae96426e6d9a4243878142ef45354222f82542629527420280ff416c2066417e3996420d838e424182e3410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fa370000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c8b700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004837000000000000c8b60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018000000";
  int params_len = 0;
  uint8_t *hk_params = dt_exif_xmp_decode
    (hk_params_input,
     strlen(hk_params_input), &params_len);
  assert(params_len == sizeof(dt_iop_colorchecker_params_t));
  assert(hk_params);
  dt_gui_presets_add_generic(_("Helmholtz/Kohlrausch monochrome"), self->op,
                             self->version(), hk_params, params_len,
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);
  free(hk_params);

  /** The following are based on Jo's Fuji film emulations, without
   *  tonecurve which is let to user choice
   *  https://jo.dreggn.org/blog/darktable-fuji-styles.tar.xz **/

  const char *astia_params_input =
  "20f59e427e278d42a2ae6f4218265742c69f4e4282bb1b4200831942eca40942d85cb641000048430000c842083a964214368d42fb258b42928b73424cad4d4231ab3e42093f3c42d38e0c42d828fb412299b841c6e7ad41b2a0a44296dd90422827874224e97c42f4606f425c795b42088b434229b7154206ff1442f61f074229a70442a620fa4120bc9b4160729b41bc109b41ce889441be73904110486e419878b940fa849142fc3c7d42e4d37442aed36f42c5b50d42877d0742e821a0411ae11341a871a4be4a1979c17d9794c18c26ebc17682e8bfec9823c1d2ae6cc03bca04c27ea111c10000000000000000bcda0b3f18478e40040b023f66ca9741097a96413c7eb14104090b41079b0b4236804a423a1624412c95ab41f8e0323f672c684136a909401fb4dc4134380e4188acfe400e6d3e425f60564040228d40b041904176f8dd41127986420bcc2a42b88bc041e7eaa9402ab50341e5f6f841a2dab840333c36426ae64fc106e5aac1a0eac5c19e42babf844ad8c139be78c198f65fc1101fa8bda089444163890b413a7f8a41c748b741979736422c2798413b18fc4024fde6414f3b73410000000000000000fcfb134234fb754246425b4140dc353f4487ce412cf53142ea844d41089ebb41bc42ed411c3d7641af131b41aea35ac0e48351c13f1a92c0b182a7c1892d8ac158c606c2406af6c1992d3ac1dd9ae2c149a950c2c608e7c0c0ff0dc268aaf3c1bf8b90c1aea004c21f564bc2db46c9c0a8a098bf5ee18cc20b3878c18de1d7c1e0c533c142ba1bc1ecd83cc106d411c20603e9c0907a30c0bea4a142fe288c42d48b6042a4c54e42ac414842f68a1542804a1442510b06429c18ac41264845435e58b24213c197428e4b8d4255e18c42ceb17542d0d64042d3293942f92f364293aa0f4296bc0c42b42fb841ceadb441ca69a542e67e984293338742c2248742a8c07c42ee3c6342923a5a429e07184213dc2042d6901f42301d0d42778a2442d6dfd74108a7b541baecc641de56e841bedfb3417a076f41ec9dc24123d19742081185424e427a427c4578424ab81942c07c224200eea94108d1134170d930bfd5e49ac143b4adc1e3180bc2248b4dbf3e6624c13e266bc034f6c6c1f5a3ecc000803bb9008890baf892bf3eb7ffc0400a16fd3f497ab04161009a416eddc941121a0d417b740d42cbf6354235603e4136ce9c41002c493eda48614199e90640ac88f64135230e41a69fac40dbb23c427bce3540a18b4d40f4ce5a41c7b0d84110816b42b4ddf741d01a98418d2510413dcc8b412331bd41efe896407578e64129fd98c1617010c2242005c23e4d85c05be37ac194fa68bf0178d2c028bacc3d46f2674121d83a413a349f416a60d141d6e0264272e8a2417c590f414c1cc241c4df634100e0f63a00b6003c1df73442b2b97442d4d78f41481be73f06bbca41d39c1642f48c674191c5a8414638b9413cc6794191c3354102e024c0262653c11276b8c07a3ad5c1d4d8c1c1e7b039c28ec129c2b5156ec1d82a26c2160a97c2626400c1bec74ac2fe5bf6c1465e87c13ab90dc2c5c47ec2581a2bc038ea0cbf06b38bc2488593c1f8140dc240a6b6c1689254c182c683c13e216cc2a03dd9c0028e10c031000000";

  uint8_t *astia_params = dt_exif_xmp_decode(
      astia_params_input, strlen(astia_params_input), &params_len);

  assert(params_len == sizeof(dt_iop_colorchecker_params_t));
  assert(astia_params);
  dt_gui_presets_add_generic(_("Fuji Astia emulation"), self->op,
                             self->version(), astia_params, params_len,
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);
  free(astia_params);


  const char *chrome_params_input =
  "d303b542eb5a9742ccdd7d4288707142ee9d40427af718427062d641000048430000c8420d96bc42faeaae429c32aa423a6ca9423c9ba7425993a0424e639542788d9242a722894260eb7f42d2876b420c724442dcba4042b6c02b42a8990b421276de41ac68c2410790a542393b9242a7279242a45d8f42a132864230e57e42002145426c3f44428a0b274204e62342b092fd41d68fcd41e02cbb419e07bb41ac2433413247b742a3ad9242006a924293d98142ae892e422cd42642366a26429c7ec44175d738c170f6d7c16fbc62c0116916c25d263dc13639f4c1352ac7c0000000000000000050176d3fe59a98400047863f168f2a401e8d0a41d72e8c418626bb4110dd5341c02f0e4270d9b03ef8c9fd4116fbb9411f8f6542391bfa41a0872f42815d56415e5f06420deec841b2d5b141de5f0841ee252342db21154160bd43405af34f40d5688e42624ea741f1799641242473400a34294238e8114241ee0f41383f184052f118c1724989c18c3c9ec0cf0decc138a006c29d4f65c0ef399fc1ea1696c17ba0f7405e30a741a026964231230042f235c641d6eee641aa7a5a410000000000000000b421d241467c8142ae6de741f7a0ee40a00da9423cb40742d6f24240461c864112558741c9ae1542089484423d261242e79d0a427392c240668cd341d554b241dd0ced40e72188c1091983c1e40b55c1f7b6cdc1304713c2360f12c0b8ca24c06a8319c232e36dc2a96dffc185040ac00e1ae8c1449c95c2c20370c29c0736bf6cce33c12c2200c2d0235cc177a125c2aa6f4fc11aab49c1bcb428c274a900c14babb542f2118d42489f6a42e4de5442c2153142be3202428ef2be4137584743b41ac3428d7dc042f9e4a7422c8fac425b61b04217c69a42d69e9b4255ec974210fa8c4298b687428a7a714282ef5f4292923942805242423c032d4222a90e421665d841a0dbda4154d9aa4255269e425ac99842d51a9a42a8bf8b4244637e42ea414542eac56a4280184042bb6d3542a4070042bf650242a7c111425a620642466841414be5b34248d59042e58c95422ef8814264842c423bef2542bc3f3742e63ac141fb61aac16444c7c1b455523ff40b0ec259efe8c055ec9cc166182cc00000fab800007ab97fc70fc15aec44c1c0eaa4bf4e5fe84072b9f9c0cf0a0041e0859641ac1d5241bb43b641d2a95840ce0bdb41420ca541583e2842c50aba416d47f641188f51410313b5416eec9f41b120c041284ba040a6b2e3417c0ffbbf711224407cdd2f40d2a2364219c555c0daaef1407be03240a8b5b4412e221e402cc6bcbe3067883f51cbc5c1e74603c2d25b09c188a03bc2be01abc1b07bb0c029248cc131a90ac1320d4a41a82c6e416a983f42cd15b741b8ef8941c00e88415aeaee400080ed390010d63a78ed0242dcc74f427ad0de41c023394128677642a7aecb4154458440d4f8504140563b41a9c3e64150812542f354c6414e45ba41bab6c240b6a49241c3a15c412c6e08410c168ec108f28cc1707549c18795ecc1a2b80cc2b861c2bf40480bc035b8d1c13b7a27c2875cb7c18a91acbfc9cd7ac13b382fc27eed03c2003cbe3abf62ecc03433dec17f0a69c1b58ae7c1fc0df5c09cbf17c143b7d6c124d68ac031000000";

  uint8_t *chrome_params = dt_exif_xmp_decode
    (chrome_params_input, strlen(chrome_params_input), &params_len);

  assert(params_len == sizeof(dt_iop_colorchecker_params_t));
  assert(chrome_params);
  dt_gui_presets_add_generic(_("Fuji Classic Chrome emulation"), self->op,
                             self->version(), chrome_params, params_len,
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);
  free(chrome_params);


  const char *mchrome_params_input =
  "287bc242632bb84226d3b54263b1a142befa904280da8942e09a88426c9d67425e6254420abc3042000048438be5aa4213ca99420d748842548c7c42d00a5942a46147422410444227060042b8bfff41348ec742c672b04293a7aa425e7f9d425e779b421a2c9a422b1f9a42fd0b87420a1e7b426e0772429e404a422a3e4a4220fc47423e8d414290c1e8412c6ddd412422cf41cce0b7419cc96441050bc4427c9fc142cebba142dbe0a04224bba04239449f4206e96e42bcec42428292e341b63ed641ca5f2dc02cfe09bfeab32cc0ca08ccc1a49ebbc1640dfcc09c6465bf7de528c2828667c19a8516c2000000002024e040c553d1419ee5594166cd9d4102e2164294636342ae0a19427699cb41a4e0de3e24a60a3fca0aa24112b99040fe569340f8adb441dc810d42aa00f740e048cc3f226070428bc677410000fa3f1053a840e46ed341aea6494144836441a2fd2f42a702824152a14142a2ea103f00e426c1c897d0c1f462f6c1fbfea9c1cb29f1c1175d1ac1efcfb9c1175407c281b891c19ced14c161f0d04192d26b42863e9a41fd251042c58c5041189b884282c51641d981fa416aa89d413b0e1e4100000000ca02b040c8fafa3ffde2b541a4fc0641c47e2e429fb2da404125b14124141a3f7c06a53fc0aae9be3817c0c16f24a8c09a8cabc1e0f6fac154eb25c2927530c2389b4fc1e97a4cc210946ec23e2934c148e702c2400ce8c1257492c2c1fe84c15e791ac2868f90c2599db5c2f66fe9c082aa61c09e38abc0585464bfcec916c2f6cfb8c16b022bc14d3275c26955a0c11a2946c146d9fac1ccf5be428046ac4247acbe4208b697427529894244c87f421ac5874230733d42722546425c5c07426aca474358f8b9421ea1a6427ee58d42e7208842d2416a426a656742fa625742012c0f4280bafb414f0ec542b457bf42a8eab14292dd9c421c95a242e5e4a54279da9942574c8842ff55914222fd7a420e9c4b42f8c44842c2da59421ae935421a45fa4126010c42ecdbd1418a2bd94140c36041ec10bf424b81a9425cfd8f421fa88b42abfb8742d9a9994298f23242ad2f12422a33bd41c8dabb41008ae3bc00b209bc8045e4bc00e87dbb0028a0ba00606aba0028a0ba0000fab700007ab900b0b3390000fa3880fdefbc00d2d7bb00c406bb00f8a7ba007014ba00b033ba0020cbb900a08c390010a43900349ebb8051e2bc003248bc0044c5bb00f6d1bb00ccd8bb00007abb0010a4ba00d004bb003072ba00803bb900007ab90060eab90000fa3700b0b3390010a4390060ea390060ea3900e8003a0007e4bc0008cfbb00a00cbb00940ebb0010a4ba00f47bbb0000fa3700803b390030f2390000fa3920a14f3e8081733de017503e0041eb3c00ec103c0060d13b0012133c0000c8b80020b23a008419bb00001639404f593e00e6433d0094723c0044133c00ec903b000c943b0068583b00040dbb005421bb001d713de0eb4e3ec097b63d00442c3d807d313d005d453d007ee53c004a123c00ca693c00d8d63b0070ad3a0070ad3a00b8533b008009b9001c22bb00e012bb00d04fbb003847bb00b86cbbc0334f3e802f3e3d004e6d3c0038793c0012133c005fe63c008009b90088dbba007c5dbb00705fbb31000000";

  uint8_t *mchrome_params = dt_exif_xmp_decode
    (mchrome_params_input, strlen(mchrome_params_input), &params_len);

  assert(params_len == sizeof(dt_iop_colorchecker_params_t));
  assert(mchrome_params);
  dt_gui_presets_add_generic(_("Fuji Monochrome emulation"), self->op,
                             self->version(), mchrome_params, params_len,
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);
  free(mchrome_params);


  const char *provia_params_input =
  "aa1fae42b13a98429c8997420bbc8f4264bb81424e3f76423a034642de774542b8522142000048430000c8422467bc42f123b2422c209e4282049842fc5b9342567d8b423c50704286f657424e153842deec2f4239fc0d428857de41de0aca414552bd4233bdb342973099428ddb95420af59442f7df9442f0a89442a73d874206ff75428c79704248b5484214c93e42aaee344234af074246a0d04156a284412c803b41f8d7ba4248029d42ddd3964200e884421e123142485c2c42c80e2c42ce24c441ff528ec1f8f123c14b9869c05c0bfdc18c4191bf6dc517c25d1ad6c1f2cd3ec176a711c200000000000000003242bd3fce19a2407cc67a41c7b6784152e27a41982e1142ecbd9f4142e53142f0da7d423b50ff41e574314270501140f6fad04154c232414eef50402f2ce040164c1c4184deb64190aa8f4048930a42bd5d46409d2f6642a6bd4841704e5c40e18dd441b6b79a42ca88dc41ee6e5542333e7d413cc16d3e39061ec16f90cec1c6736ac1143cefc14e0ad8c180ce9dc181d75dc0f5da2dc1b2ce4141fd67a4414d0d26427e43c6419a48664289f20042a8713f42c7dbc441c3dd52410000000000000000a1cd1242fab58242300db2427767e94004a1cd41aa56844166861442a95c5542b9287a41c117b340f682cb414e54c440fdeb76411c4c0bc1469f58c0cce3f0c1537f02c1c7768ac13a0a9ec1d151cdc1a43e47c0946b09c2e9b036c2b8de42c0a5de98c15c0722c2934588c22a7911c2ef9cddc1377a1ec072313dc18f46f2c125f1f7c0acb628c2367522c1fe682bc2c68d55c1af28ccc1ff7ab44211c69742e6f08d42e2918942b03c7842061e6c4265603b42dd9f3942ae882142cc0e48430e6dc842e4f5c2429960b942005490427ab3994210e68c4225cc86427ea6664270774a42fcf6394250a931427a111642226bce41de78d441963fc3425c07b44204ad9b42b72d9d42f9cb9f42d1f59c42bd9c9c4221488742c23a854240d87f4264c648426cb54a4264ce5642f4d92d429ef80d42accba741007f3b4154cabc42993ba44260959b422b7396421c5a3742f48a4a42397a2c429c51e14190161fc222ff73c16fe39dc0cbbd33c2e00058bffabb4bc283daf8c181095ac138a6f4c10000fa3800007a386881b1c15b5c03c24454f83f04aaa64170cd9141ca3cd641a618bc415d2c2042e1bf5542fd60054232552a42b6da20408ab1c14178bfa140f258b440c0e3ba3d66036e414efafa41aa6a3340158303424c05fe3fcbf3344231607a40a2e66440a045da4109637d425dbb6741f4002542b7c23141b018ff3d9b08fac10b2f6cc231a3c3c11e1a72c21ceed2c1b33887c1346393c0d2a38ac0c4c7b9416c71c34101e52d4208cce641b8fd5842397b14429dda1b42e4a2c841aab68d41000048b8000016b9a12f504214e69c422a9e8d42e6791241c41ed941b39a4a417a52144297102642dc4e2b41a152ca40086ac441748eb3404a6369413aac87c09cef18c1bb1805c2be0f4bc1a7bce6c1bc6701c26233f4c1b6b040c0909a26c2c2e040c290ca65c0aaa4b2c1bce85ac2df088fc2423808c2f7d5b5c1255fbcbfd0ad1cc1eef8eac10e2832c18df519c2df67f4c0accb37c26cf164c1f460a3c131000000";

  uint8_t *provia_params = dt_exif_xmp_decode
    (provia_params_input, strlen(provia_params_input), &params_len);

  assert(params_len == sizeof(dt_iop_colorchecker_params_t));
  assert(provia_params);
  dt_gui_presets_add_generic(_("Fuji Provia emulation"), self->op,
                             self->version(), provia_params, params_len,
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);
  free(provia_params);


  const char *velvia_params_input =
  "3f259c42b92693425c7b83420e107d42f86e4f4252a94b4293c32042db870442269da341000048430000c8427ee97f42ceca7342e81e6b42c9eb3e425514254248600f42c0fc0242ea69e941022bcd414624994222cb8d42f57d8842d77587428cea6e421c546c42b2a668429eda5e42da4a5e42242f2f42f37a1542c0fd0d42d0e30842867bab414eeca34154c46941482b5f41d08646415e552c41c512a5423390964242c7914260c07e42ea6176429c79744286010e4273310b42d6a28541fa0a4a41ca2161c0af9206c045d4f4c07ec5c3c1633ccec0d57efac17e2981c1f8449ec112a734c00000000000000000ad5fd440cb8a9441e0fab740a649a941f85d6b41387b2541888d2e42853cc241c33ad0406843c4408eb22d41c016713d7fd79541da99953f7d70c241ba600142f0d0273fd25e0541ceda4e42456b944138a29d41f76448424a941c41d0cc1642a54ba0412c030c428342874106e0e54032bfbdbfab3a48c13fe059c1d141a0c1e655c1c1ac9c49c190d038c1e3c242c094c185c0217c5ac075074e410485174251beb941c0c422412bf53c4282ada0410571a64130a5d93f584cab3e000000000000000004d88f4229c6ba4053185a41e8d51f4268579f41302c503f87e59a410806fe4085f0cf40e67992c190b1ccc0e75c45c19ee3d1c16677a1c11b6e81c1461c06c26c192cc1ef3128c2378125c29272b0c142de69c2154e7bc120564cc2d4a807c2aa6f15c12e2e82c20fa010c200327cc1fe8a4dc1502e4cc0a6debec11a4609c230e38cc112a5c5c042f01dc2b4aa7ec1fd3986c15abf8dc0282aa242f202994250707d429aed7b42604a51424c8b4e42efac1f4276070e426420a441d3d84443567fae4219ce83425a567b4214286242a8554642f1421e42c3f10d427cab1c426af6f5416221ce416de0a14206bf9242de7e8842d21d9142668d7d42465c7e42acb57c428ada5e42f4516242eaf9514232971f42c7522042028e2b42747af9410c8aef4158809141603adb4150e2a7411e1815413287a7429d2d9a420bea9c429a418d428ea5864280877f42687f3142e5cb0f42d85b9f4160000d41c30fbec0b4246fc03f0f46c19b1c1ac2f36b08c1f2513cc2b239b4c196fda7c1123632c000409cb90010a4ba349c76416a78ea410249f3404dfd00427f41974148854d4140604c42c70edc413bf6064131cc684008178941bcb2653fa9edaf4160fe4d40b8121a4222fd2a420238c03fd436d8405e0577429e85bb41f7b899419b5469426c50c541f7e217425da58e41c99c1442ef1690417ac27e416b5e56c0a5d1a5c12405f6c12c5e1bc26ab106c2c5a59ec142693dc0f43a11c082d65140698887c0efab9c41c5de6842b0e8054221f29041eeab36420440f241673fc6410201b4404822063f00e0123b001a1a3ce60f8242e6631e41ef649b41813329425bfeb741fea0973ff9f8d0419a453f41362007412eee15c128293fc18667b0c12eb0acc14bb20fc213a7ebc1281c0dc29cd587c1f61739c2f7974cc2ac6c08c2003c8fc2389bb6c119b5a2c214a74ec266f4ecc05264b6c2107819c2f476a9c17398a8c05af39dc02d6e5cc16d31cec11095f4c1fe9e20c1bfbd76c2d3adc1c12fea7fc196bf11c131000000";

  uint8_t *velvia_params = dt_exif_xmp_decode
    (velvia_params_input, strlen(velvia_params_input), &params_len);

  assert(params_len == sizeof(dt_iop_colorchecker_params_t));
  assert(velvia_params);
  dt_gui_presets_add_generic(_("Fuji Velvia emulation"), self->op,
                             self->version(), velvia_params, params_len,
                             TRUE, DEVELOP_BLEND_CS_RGB_DISPLAY);
  free(velvia_params);
}

// thinplate spline kernel \phi(r) = 2 r^2 ln(r)
DT_OMP_DECLARE_SIMD(aligned(x, y))
static inline float kernel(const dt_aligned_pixel_t x,
                           const dt_aligned_pixel_t y)
{
  dt_aligned_pixel_t diff2;
  for_each_channel(c)
  {
    diff2[c] = (x[c] - y[c]);
    diff2[c] *= diff2[c];
  }
  const float r2 = diff2[0] + diff2[1] + diff2[2];
  return r2*fastlog(MAX(1e-8f,r2));
}

void process(dt_iop_module_t *self,
             dt_dev_pixelpipe_iop_t *piece,
             const void *const ivoid,
             void *const ovoid,
             const dt_iop_roi_t *const roi_in,
             const dt_iop_roi_t *const roi_out)
{
  if(!dt_iop_have_required_input_format(4 /*we need full-color pixels*/,
                                        self, piece->colors,
                                        ivoid, ovoid, roi_in, roi_out))
    return;

  const dt_iop_colorchecker_data_t *const data = piece->data;
  const size_t npixels = (size_t)roi_out->height * (size_t)roi_out->width;
  float *const restrict out = (float*)DT_IS_ALIGNED(ovoid);

  // convert patch data from struct of arrays to array of structs so
  // we can vectorize operations
  const int num_patches = data->num_patches;
  dt_aligned_pixel_t *sources = dt_alloc_align_type(dt_aligned_pixel_t, num_patches);
  for(int i = 0; i < num_patches; i++)
  {
    sources[i][0] = data->source_Lab[3 * i];
    sources[i][1] = data->source_Lab[3 * i + 1];
    sources[i][2] = data->source_Lab[3 * i + 2];
    sources[i][3] = 0.0f;
  }
  dt_aligned_pixel_t *patches = dt_alloc_align_type(dt_aligned_pixel_t, (num_patches + 1));
  for(int i = 0; i <= num_patches; i++)
  {
    patches[i][0] = data->coeff_L[i];
    patches[i][1] = data->coeff_a[i];
    patches[i][2] = data->coeff_b[i];
    patches[i][3] = 0.0f;
  }
  const dt_aligned_pixel_t polynomial_L =
    { data->coeff_L[num_patches+1],
      data->coeff_L[num_patches+2],
      data->coeff_L[num_patches+3], 0.0f };
  const dt_aligned_pixel_t polynomial_a =
    { data->coeff_a[num_patches+1],
      data->coeff_a[num_patches+2],
      data->coeff_a[num_patches+3], 0.0f };
  const dt_aligned_pixel_t polynomial_b =
    { data->coeff_b[num_patches+1],
      data->coeff_b[num_patches+2],
      data->coeff_b[num_patches+3], 0.0f };

  DT_OMP_FOR()
  for(int k=0; k < npixels; k++)
  {
    dt_aligned_pixel_t inpx;
    copy_pixel(inpx, ((float *)ivoid) + 4*k);

    // polynomial part:
    dt_aligned_pixel_t poly_L, poly_a, poly_b;
    for_each_channel(c)
    {
      poly_L[c] = (polynomial_L[c] * inpx[c]);
      poly_a[c] = (polynomial_a[c] * inpx[c]);
      poly_b[c] = (polynomial_b[c] * inpx[c]);
    }
    dt_aligned_pixel_t sums = { poly_L[0] + poly_L[1] + poly_L[2],
      				poly_a[0] + poly_a[1] + poly_a[2],
                                poly_b[0] + poly_b[1] + poly_b[2],
                                0.0f };
    dt_aligned_pixel_t res;
    for_each_channel(c)
      res[c] = patches[num_patches][c] + sums[c];
    for(int p=0; p < num_patches; p++)
    {
      // rbf from thin plate spline
      const float phi = kernel(inpx, sources[p]);
      for_each_channel(c)
        res[c] += patches[p][c] * phi;
    }
    copy_pixel_nontemporal(out + 4*k, res);
  }
  dt_omploop_sfence();
  dt_free_align(patches);
  dt_free_align(sources);
}

void commit_params(dt_iop_module_t *self,
                   dt_iop_params_t *p1,
                   dt_dev_pixelpipe_t *pipe,
                   dt_dev_pixelpipe_iop_t *piece)
{
  dt_iop_colorchecker_params_t *p = (dt_iop_colorchecker_params_t *)p1;
  dt_iop_colorchecker_data_t *d = piece->data;

  d->num_patches = MIN(MAX_PATCHES, p->num_patches);
  const unsigned N = MAX(0, d->num_patches);
  const unsigned N4 = N + 4;

  for(unsigned k = 0; k < N; ++k)
  {
    d->source_Lab[3*k+0] = p->source_L[k];
    d->source_Lab[3*k+1] = p->source_a[k];
    d->source_Lab[3*k+2] = p->source_b[k];
  }

  // initialize coefficients with default values that will be
  // used for N<=4 and if coefficient matrix A is singular
  for(unsigned i = 0; i < N4; ++i)
  {
    d->coeff_L[i] = 0;
    d->coeff_a[i] = 0;
    d->coeff_b[i] = 0;
  }
  d->coeff_L[N + 1] = 1;
  d->coeff_a[N + 2] = 1;
  d->coeff_b[N + 3] = 1;

  /*
      Following

      K. Anjyo, J. P. Lewis, and F. Pighin, "Scattered data
      interpolation for computer graphics," ACM SIGGRAPH 2014 Courses
      on - SIGGRAPH ’14, 2014.
      http://dx.doi.org/10.1145/2614028.2615425
      http://scribblethink.org/Courses/ScatteredInterpolation/scatteredinterpcoursenotes.pdf

      construct the system matrix and the vector of function values and
      solve the set of linear equations

      / R   P \  / c \   / f \
      |       |  |   | = |   |
      \ P^t 0 /  \ d /   \ 0 /

      for the coefficient vector (c d)^t.

      By design of the interpolation scheme the interpolation
      coefficients c for radial non-linear basis functions (the kernel)
      must always vanish for N<=4.  For N<4 the (N+4)x(N+4) coefficient
      matrix A is singular, the linear system has non-unique solutions.
      Thus the cases with N<=4 need special treatment, unique solutions
      are found by setting some of the unknown coefficients to zero and
      solving a smaller linear system.
  */
  switch(N)
  {
  case 0:
    break;
  case 1:
    // interpolation via constant function
    d->coeff_L[N + 1] = p->target_L[0] / p->source_L[0];
    d->coeff_a[N + 2] = p->target_a[0] / p->source_a[0];
    d->coeff_b[N + 3] = p->target_b[0] / p->source_b[0];
    break;
  case 2:
    // interpolation via single constant function and the linear
    // function of the corresponding color channel
    {
      double A[2 * 2] = { 1, p->source_L[0],
                          1, p->source_L[1] };
      double b[2] = { p->target_L[0], p->target_L[1] };
      if(!gauss_solve(A, b, 2)) break;
      d->coeff_L[N + 0] = b[0];
      d->coeff_L[N + 1] = b[1];
    }
    {
      double A[2 * 2] = { 1, p->source_a[0],
                          1, p->source_a[1] };
      double b[2] = { p->target_a[0], p->target_a[1] };
      if(!gauss_solve(A, b, 2)) break;
      d->coeff_a[N + 0] = b[0];
      d->coeff_a[N + 2] = b[1];
    }
    {
      double A[2 * 2] = { 1, p->source_b[0],
                          1, p->source_b[1] };
      double b[2] = { p->target_b[0], p->target_b[1] };
      if(!gauss_solve(A, b, 2)) break;
      d->coeff_b[N + 0] = b[0];
      d->coeff_b[N + 3] = b[1];
    }
    break;
  case 3:
    // interpolation via single constant function, the linear function
    // of the corresponding color channel and the linear functions
    // of the other two color channels having both the same weight
    {
      double A[3 * 3] = { 1, p->source_L[0], p->source_a[0] + p->source_b[0],
                          1, p->source_L[1], p->source_a[1] + p->source_b[1],
                          1, p->source_L[2], p->source_a[2] + p->source_b[2] };
      double b[3] = { p->target_L[0], p->target_L[1], p->target_L[2] };
      if(!gauss_solve(A, b, 3)) break;
      d->coeff_L[N + 0] = b[0];
      d->coeff_L[N + 1] = b[1];
      d->coeff_L[N + 2] = b[2];
      d->coeff_L[N + 3] = b[2];
    }
    {
      double A[3 * 3] = { 1, p->source_a[0], p->source_L[0] + p->source_b[0],
                          1, p->source_a[1], p->source_L[1] + p->source_b[1],
                          1, p->source_a[2], p->source_L[2] + p->source_b[2] };
      double b[3] = { p->target_a[0], p->target_a[1], p->target_a[2] };
      if(!gauss_solve(A, b, 3)) break;
      d->coeff_a[N + 0] = b[0];
      d->coeff_a[N + 1] = b[2];
      d->coeff_a[N + 2] = b[1];
      d->coeff_a[N + 3] = b[2];
    }
    {
      double A[3 * 3] = { 1, p->source_b[0], p->source_L[0] + p->source_a[0],
                          1, p->source_b[1], p->source_L[1] + p->source_a[1],
                          1, p->source_b[2], p->source_L[2] + p->source_a[2] };
      double b[3] = { p->target_b[0], p->target_b[1], p->target_b[2] };
      if(!gauss_solve(A, b, 3)) break;
      d->coeff_b[N + 0] = b[0];
      d->coeff_b[N + 1] = b[2];
      d->coeff_b[N + 2] = b[2];
      d->coeff_b[N + 3] = b[1];
    }
    break;
  case 4:
  {
    // interpolation via constant function and 3 linear functions
    double A[4 * 4] = { 1, p->source_L[0], p->source_a[0], p->source_b[0],
                        1, p->source_L[1], p->source_a[1], p->source_b[1],
                        1, p->source_L[2], p->source_a[2], p->source_b[2],
                        1, p->source_L[3], p->source_a[3], p->source_b[3] };
    int pivot[4];
    if(!gauss_make_triangular(A, pivot, 4)) break;
    {
      double b[4] = { p->target_L[0],
                      p->target_L[1],
                      p->target_L[2],
                      p->target_L[3] };
      gauss_solve_triangular(A, pivot, b, 4);
      d->coeff_L[N + 0] = b[0];
      d->coeff_L[N + 1] = b[1];
      d->coeff_L[N + 2] = b[2];
      d->coeff_L[N + 3] = b[3];
    }
    {
      double b[4] = { p->target_a[0],
                      p->target_a[1],
                      p->target_a[2],
                      p->target_a[3] };
      gauss_solve_triangular(A, pivot, b, 4);
      d->coeff_a[N + 0] = b[0];
      d->coeff_a[N + 1] = b[1];
      d->coeff_a[N + 2] = b[2];
      d->coeff_a[N + 3] = b[3];
    }
    {
      double b[4] = { p->target_b[0],
                      p->target_b[1],
                      p->target_b[2],
                      p->target_b[3] };
      gauss_solve_triangular(A, pivot, b, 4);
      d->coeff_b[N + 0] = b[0];
      d->coeff_b[N + 1] = b[1];
      d->coeff_b[N + 2] = b[2];
      d->coeff_b[N + 3] = b[3];
    }
    break;
  }
  default:
  {
    // setup linear system of equations
    double *A = malloc(sizeof(*A) * N4 * N4);
    double *b = malloc(sizeof(*b) * N4);
    // coefficients from nonlinear radial kernel functions
    for(unsigned j = 0; j < N; ++j)
      for(unsigned i = j; i < N; ++i)
        A[j * N4 + i] = A[i * N4 + j] =
          kernel(d->source_Lab + 3 * i, d->source_Lab + 3 * j);
    // coefficients from constant and linear functions
    for(unsigned i = 0; i < N; ++i)
      A[i * N4 + N + 0] = A[(N + 0) * N4 + i] = 1;
    for(unsigned i = 0; i < N; ++i)
      A[i * N4 + N + 1] = A[(N + 1) * N4 + i] = d->source_Lab[3 * i + 0];
    for(unsigned i = 0; i < N; ++i)
      A[i * N4 + N + 2] = A[(N + 2) * N4 + i] = d->source_Lab[3 * i + 1];
    for(unsigned i = 0; i < N; ++i)
      A[i * N4 + N + 3] = A[(N + 3) * N4 + i] = d->source_Lab[3 * i + 2];
    // lower-right zero block
    for(unsigned j = N; j < N4; ++j)
      for(unsigned i = N; i < N4; ++i) A[j * N4 + i] = 0;
    // make coefficient matrix triangular
    int *pivot = malloc(sizeof(*pivot) * N4);
    if(gauss_make_triangular(A, pivot, N4))
    {
      // calculate coefficients for L channel
      for(unsigned i = 0; i < N; ++i)
        b[i] = p->target_L[i];
      for(unsigned i = N; i < N4; ++i)
        b[i] = 0;
      gauss_solve_triangular(A, pivot, b, N4);
      for(unsigned i = 0; i < N4; ++i)
        d->coeff_L[i] = b[i];
      // calculate coefficients for a channel
      for(unsigned i = 0; i < N; ++i)
        b[i] = p->target_a[i];
      for(unsigned i = N; i < N4; ++i)
        b[i] = 0;
      gauss_solve_triangular(A, pivot, b, N4);
      for(unsigned i = 0; i < N4; ++i)
        d->coeff_a[i] = b[i];
      // calculate coefficients for b channel
      for(unsigned i = 0; i < N; ++i)
        b[i] = p->target_b[i];
      for(unsigned i = N; i < N4; ++i)
        b[i] = 0;
      gauss_solve_triangular(A, pivot, b, N4);
      for(unsigned i = 0; i < N4; ++i)
        d->coeff_b[i] = b[i];
    }
    // free resources
    free(pivot);
    free(b);
    free(A);
  }
  }
}
/* ── end darktable ── */

/* ── the driver ───────────────────────────────────────────────────────── */

#define MAX_PRESETS 16
static struct { const char *name; dt_iop_colorchecker_params_t p; } presets[MAX_PRESETS];
static int num_presets = 0;

static void record_preset(const char *name, const void *params, const int size)
{
  assert(size == sizeof(dt_iop_colorchecker_params_t));
  assert(num_presets < MAX_PRESETS);
  presets[num_presets].name = name;
  memcpy(&presets[num_presets].p, params, size);
  num_presets++;
}

static void print_floats(const char *key, const float *v, const int n, const int last)
{
  printf("\"%s\":[", key);
  for(int i = 0; i < n; i++) printf("%s%.9g", i ? "," : "", v[i]);
  printf("]%s", last ? "" : ",");
}

/* The Lab colours every case is evaluated at: a grid over and past the Lab
 * gamut, then the default patches (where the mapping must hit its targets). */
static float inputs[4 * 2048];
static int num_inputs = 0;

static void add_input(const float L, const float a, const float b)
{
  inputs[4 * num_inputs + 0] = L;
  inputs[4 * num_inputs + 1] = a;
  inputs[4 * num_inputs + 2] = b;
  inputs[4 * num_inputs + 3] = 0.0f;
  num_inputs++;
}

static void run_case(const char *name, const dt_iop_colorchecker_params_t *p, const int last)
{
  dt_iop_colorchecker_data_t d;
  memset(&d, 0, sizeof(d));
  dt_dev_pixelpipe_iop_t piece = { &d, 4 };
  commit_params(NULL, (dt_iop_params_t *)p, NULL, &piece);

  /* the case's own patches go after the grid, so each case shows its
   * targets being hit */
  const int n = MIN(MAX_PATCHES, MAX(0, p->num_patches));
  float *in = malloc(sizeof(float) * 4 * (num_inputs + n));
  memcpy(in, inputs, sizeof(float) * 4 * num_inputs);
  for(int k = 0; k < n; k++)
  {
    in[4 * (num_inputs + k) + 0] = p->source_L[k];
    in[4 * (num_inputs + k) + 1] = p->source_a[k];
    in[4 * (num_inputs + k) + 2] = p->source_b[k];
    in[4 * (num_inputs + k) + 3] = 0.0f;
  }
  const int total = num_inputs + n;
  float *out = malloc(sizeof(float) * 4 * total);
  dt_iop_roi_t roi = { total, 1 };
  process(NULL, &piece, in, out, &roi, &roi);

  printf("{\"name\":\"%s\",\"num_patches\":%d,", name, p->num_patches);
  print_floats("source_L", p->source_L, MAX_PATCHES, 0);
  print_floats("source_a", p->source_a, MAX_PATCHES, 0);
  print_floats("source_b", p->source_b, MAX_PATCHES, 0);
  print_floats("target_L", p->target_L, MAX_PATCHES, 0);
  print_floats("target_a", p->target_a, MAX_PATCHES, 0);
  print_floats("target_b", p->target_b, MAX_PATCHES, 0);
  print_floats("coeff_L", d.coeff_L, n + 4, 0);
  print_floats("coeff_a", d.coeff_a, n + 4, 0);
  print_floats("coeff_b", d.coeff_b, n + 4, 0);
  float *rgb = malloc(sizeof(float) * 3 * total);
  for(int i = 0; i < total; i++)
    for(int c = 0; c < 3; c++) rgb[3 * i + c] = out[4 * i + c];
  print_floats("out", rgb, 3 * total, 1);
  printf("}%s\n", last ? "" : ",");
  free(rgb);
  free(out);
  free(in);
}

/* A small deterministic generator, so the cases don't depend on the libc. */
static uint32_t rng_state = 12345u;
static float rnd(const float lo, const float hi)
{
  rng_state = rng_state * 1664525u + 1013904223u;
  return lo + (hi - lo) * (float)(rng_state >> 8) / 16777216.0f;
}

static dt_iop_colorchecker_params_t defaults(void)
{
  dt_iop_colorchecker_params_t d;
  memset(&d, 0, sizeof(d));
  d.num_patches = colorchecker_patches;
  for(int k = 0; k < d.num_patches; k++)
  {
    d.source_L[k] = d.target_L[k] = colorchecker_Lab[3*k+0];
    d.source_a[k] = d.target_a[k] = colorchecker_Lab[3*k+1];
    d.source_b[k] = d.target_b[k] = colorchecker_Lab[3*k+2];
  }
  return d;
}

/* The first n default patches, each target nudged by its own offsets. */
static dt_iop_colorchecker_params_t first(const int n, const float dL, const float da, const float db)
{
  dt_iop_colorchecker_params_t p = defaults();
  p.num_patches = n;
  for(int k = 0; k < n; k++)
  {
    p.target_L[k] = p.source_L[k] + dL * (float)(k % 3 - 1);
    p.target_a[k] = p.source_a[k] + da * (float)((k + 1) % 3 - 1);
    p.target_b[k] = p.source_b[k] + db * (float)((k + 2) % 3 - 1);
  }
  return p;
}

int main(void)
{
  static const float Ls[] = { -5, 0, 5, 20, 35, 50, 65, 80, 95, 100, 130 };
  static const float abs_[] = { -120, -80, -40, -10, 0, 10, 40, 80, 120 };
  for(int i = 0; i < 11; i++)
    for(int j = 0; j < 9; j++)
      for(int k = 0; k < 9; k++) add_input(Ls[i], abs_[j], abs_[k]);
  for(int k = 0; k < colorchecker_patches; k++)
    add_input(colorchecker_Lab[3*k+0], colorchecker_Lab[3*k+1], colorchecker_Lab[3*k+2]);

  dt_iop_module_so_t so = { "colorchecker", version };
  init_presets(&so);

  printf("{\"inputs\":");
  {
    float *lab = malloc(sizeof(float) * 3 * num_inputs);
    for(int i = 0; i < num_inputs; i++)
      for(int c = 0; c < 3; c++) lab[3 * i + c] = inputs[4 * i + c];
    printf("[");
    for(int i = 0; i < 3 * num_inputs; i++) printf("%s%.9g", i ? "," : "", lab[i]);
    printf("],\n");
    free(lab);
  }

  printf("\"cases\":[\n");
  {
    dt_iop_colorchecker_params_t p = defaults();
    run_case("defaults", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = defaults();
    p.target_L[6] += 8.0f; p.target_a[6] -= 12.0f; p.target_b[6] += 5.0f;
    p.target_L[14] -= 6.0f; p.target_a[14] += 9.0f;
    p.target_a[2] -= 10.0f; p.target_b[2] -= 15.0f;
    p.target_L[19] += 4.0f;
    run_case("defaults, four patches moved", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = defaults();
    p.num_patches = 0;
    run_case("no patches", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(1, 0, 0, 0);
    p.target_L[0] = 45.0f; p.target_a[0] = 20.0f; p.target_b[0] = 10.0f;
    run_case("one patch", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(2, 6, 8, -5);
    run_case("two patches", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(2, 6, 8, -5);
    p.source_L[1] = p.source_L[0];
    run_case("two patches, same lightness", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(3, 6, 8, -5);
    run_case("three patches", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(4, 6, 8, -5);
    run_case("four patches", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(4, 6, 8, -5);
    p.source_L[3] = p.source_L[0]; p.source_a[3] = p.source_a[0]; p.source_b[3] = p.source_b[0];
    run_case("four patches, two the same", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(5, 6, 8, -5);
    run_case("five patches", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = first(24, 3, 4, -2);
    run_case("24 patches, all moved", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = defaults();
    p.source_L[5] = p.source_L[4]; p.source_a[5] = p.source_a[4]; p.source_b[5] = p.source_b[4];
    p.target_L[5] += 10.0f;
    run_case("a patch repeated", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p;
    memset(&p, 0, sizeof(p));
    p.num_patches = 49;
    for(int k = 0; k < 49; k++)
    {
      p.source_L[k] = rnd(5, 95);
      p.source_a[k] = rnd(-70, 70);
      p.source_b[k] = rnd(-70, 70);
      p.target_L[k] = p.source_L[k] + rnd(-8, 8);
      p.target_a[k] = p.source_a[k] + rnd(-10, 10);
      p.target_b[k] = p.source_b[k] + rnd(-10, 10);
    }
    run_case("49 random patches", &p, 0);
  }
  {
    dt_iop_colorchecker_params_t p = defaults();
    for(int k = 0; k < 24; k++) p.target_a[k] = p.target_b[k] = 0.0f;
    run_case("every patch to grey", &p, 1);
  }
  printf("],\n\"presets\":[\n");
  for(int i = 0; i < num_presets; i++) run_case(presets[i].name, &presets[i].p, i == num_presets - 1);
  printf("]}\n");
  return 0;
}
