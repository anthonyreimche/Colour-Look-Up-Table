var e = [
	[
		37.99,
		13.56,
		14.06
	],
	[
		65.71,
		18.13,
		17.81
	],
	[
		49.93,
		-4.88,
		-21.93
	],
	[
		43.14,
		-13.1,
		21.91
	],
	[
		55.11,
		8.84,
		-25.4
	],
	[
		70.72,
		-33.4,
		-.2
	],
	[
		62.66,
		36.07,
		57.1
	],
	[
		40.02,
		10.41,
		-45.96
	],
	[
		51.12,
		48.24,
		16.25
	],
	[
		30.33,
		22.98,
		-21.59
	],
	[
		72.53,
		-23.71,
		57.26
	],
	[
		71.94,
		19.36,
		67.86
	],
	[
		28.78,
		14.18,
		-50.3
	],
	[
		55.26,
		-38.34,
		31.37
	],
	[
		42.1,
		53.38,
		28.19
	],
	[
		81.73,
		4.04,
		79.82
	],
	[
		51.94,
		49.99,
		-14.57
	],
	[
		51.04,
		-28.63,
		-28.64
	],
	[
		96.54,
		-.43,
		1.19
	],
	[
		81.26,
		-.64,
		-.34
	],
	[
		66.77,
		-.73,
		-.5
	],
	[
		50.87,
		-.15,
		-.27
	],
	[
		35.66,
		-.42,
		-1.23
	],
	[
		20.46,
		-.08,
		-.97
	]
];
function t(e) {
	for (let t of e.patches) Object.freeze(t);
	return Object.freeze(e.patches), Object.freeze(e);
}
var n = t({ patches: e.map((e) => ({
	source: e,
	target: e
})) }), r = (e) => e.patches.every((e) => e.source[0] === e.target[0] && e.source[1] === e.target[1] && e.source[2] === e.target[2]), i = Math.fround, a = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(4)), o = Object.freeze({
	scale: 1.1920928955078125e-7,
	bias: i(124.22551499),
	a: i(1.498030302),
	b: i(1.72587999),
	c: i(.3520887068)
}), s = i(.6931471805599453), c = i(1e-8), { bias: l, a: u, b: d, c: f } = o;
function p(e) {
	a.setFloat32(0, e, !0);
	let t = a.getUint32(0, !0);
	a.setUint32(0, (t & 8388607 | 1056964608) >>> 0, !0);
	let n = a.getFloat32(0, !0);
	return i(i(i(i(i(t) * o.scale) - l) - i(u * n)) - i(d / i(f + n)));
}
function m(e, t) {
	let n = i(e[0] - t[0]), r = i(e[1] - t[1]), a = i(e[2] - t[2]), o = i(i(i(n * n) + i(r * r)) + i(a * a));
	return i(o * i(s * p(o > c ? o : c)));
}
function h(e, t, n) {
	t[n - 1] = n - 1;
	for (let r = 0; r < n; ++r) {
		let i = r;
		for (let t = r + 1; t < n; ++t) Math.abs(e[r + n * t]) > Math.abs(e[r + n * i]) && (i = t);
		t[r] = i;
		let a = e[r + n * i];
		if (e[r + n * i] = e[r + n * r], e[r + n * r] = a, a === 0) return !1;
		for (let t = r + 1; t < n; ++t) e[r + n * t] /= -a;
		if (r !== i) for (let t = r + 1; t < n; ++t) {
			let a = e[t + n * i];
			e[t + n * i] = e[t + n * r], e[t + n * r] = a;
		}
		for (let t = r + 1; t < n; ++t) for (let i = r + 1; i < n; ++i) e[i + n * t] += e[r + t * n] * e[i + r * n];
	}
	return !0;
}
function g(e, t, n, r) {
	for (let i = 0; i < r - 1; ++i) {
		let a = t[i], o = n[a];
		n[a] = n[i], n[i] = o;
		for (let t = i + 1; t < r; ++t) n[t] += e[i + r * t] * o;
	}
	for (let t = r - 1; t > 0; --t) {
		n[t] /= e[t + r * t];
		let i = n[t];
		for (let a = 0; a < t; ++a) n[a] -= e[t + r * a] * i;
	}
	n[0] /= e[0];
}
function _(e, t, n) {
	let r = new Int32Array(n);
	return h(e, r, n) ? (g(e, r, t, n), !0) : !1;
}
function v(e) {
	let t = Math.min(49, e.patches.length), n = t + 4, r = e.patches.slice(0, t).map((e) => [
		i(e.source[0]),
		i(e.source[1]),
		i(e.source[2])
	]), a = e.patches.slice(0, t).map((e) => [
		i(e.target[0]),
		i(e.target[1]),
		i(e.target[2])
	]), o = r.map((e) => e[0]), s = r.map((e) => e[1]), c = r.map((e) => e[2]), l = a.map((e) => e[0]), u = a.map((e) => e[1]), d = a.map((e) => e[2]), f = new Float32Array(n), p = new Float32Array(n), v = new Float32Array(n);
	f[t + 1] = 1, p[t + 2] = 1, v[t + 3] = 1;
	let y = (e, t, n) => {
		let r = Float64Array.from(e.flat()), i = Float64Array.from(t);
		return _(r, i, t.length) ? (n(i), !0) : !1;
	};
	switch (t) {
		case 0: break;
		case 1:
			f[t + 1] = i(l[0] / o[0]), p[t + 2] = i(u[0] / s[0]), v[t + 3] = i(d[0] / c[0]);
			break;
		case 2:
			y([[1, o[0]], [1, o[1]]], [l[0], l[1]], (e) => {
				f[t] = e[0], f[t + 1] = e[1];
			}) && y([[1, s[0]], [1, s[1]]], [u[0], u[1]], (e) => {
				p[t] = e[0], p[t + 2] = e[1];
			}) && y([[1, c[0]], [1, c[1]]], [d[0], d[1]], (e) => {
				v[t] = e[0], v[t + 3] = e[1];
			});
			break;
		case 3:
			y([
				0,
				1,
				2
			].map((e) => [
				1,
				o[e],
				i(s[e] + c[e])
			]), [
				l[0],
				l[1],
				l[2]
			], (e) => {
				f[t] = e[0], f[t + 1] = e[1], f[t + 2] = e[2], f[t + 3] = e[2];
			}) && y([
				0,
				1,
				2
			].map((e) => [
				1,
				s[e],
				i(o[e] + c[e])
			]), [
				u[0],
				u[1],
				u[2]
			], (e) => {
				p[t] = e[0], p[t + 1] = e[2], p[t + 2] = e[1], p[t + 3] = e[2];
			}) && y([
				0,
				1,
				2
			].map((e) => [
				1,
				c[e],
				i(o[e] + s[e])
			]), [
				d[0],
				d[1],
				d[2]
			], (e) => {
				v[t] = e[0], v[t + 1] = e[2], v[t + 2] = e[2], v[t + 3] = e[1];
			});
			break;
		case 4: {
			let e = Float64Array.from([
				0,
				1,
				2,
				3
			].flatMap((e) => [
				1,
				o[e],
				s[e],
				c[e]
			])), n = /* @__PURE__ */ new Int32Array(4);
			if (!h(e, n, 4)) break;
			for (let [r, i] of [
				[l, f],
				[u, p],
				[d, v]
			]) {
				let a = Float64Array.from(r);
				g(e, n, a, 4);
				for (let e = 0; e < 4; e++) i[t + e] = a[e];
			}
			break;
		}
		default: {
			let e = new Float64Array(n * n);
			for (let i = 0; i < t; ++i) for (let a = i; a < t; ++a) e[i * n + a] = e[a * n + i] = m(r[a], r[i]);
			for (let r = 0; r < t; ++r) e[r * n + t] = e[t * n + r] = 1, e[r * n + t + 1] = e[(t + 1) * n + r] = o[r], e[r * n + t + 2] = e[(t + 2) * n + r] = s[r], e[r * n + t + 3] = e[(t + 3) * n + r] = c[r];
			let i = new Int32Array(n);
			if (!h(e, i, n)) break;
			for (let [r, a] of [
				[l, f],
				[u, p],
				[d, v]
			]) {
				let o = new Float64Array(n);
				for (let e = 0; e < t; ++e) o[e] = r[e];
				g(e, i, o, n);
				for (let e = 0; e < n; ++e) a[e] = o[e];
			}
		}
	}
	return {
		count: t,
		sources: r,
		coeff: [
			f,
			p,
			v
		]
	};
}
function y(e) {
	return e < .04045 ? e / 12.92 : ((e + .055) / 1.055) ** 2.4;
}
function b(e) {
	return Math.sign(e) * y(Math.abs(e));
}
function x(e) {
	let t = Math.abs(e);
	return Math.sign(e) * (t < .0031308 ? t * 12.92 : 1.055 * t ** (1 / 2.4) - .055);
}
var S = [
	.9642,
	1,
	.8249
], C = [
	.4360747,
	.3850649,
	.1430804,
	.2225045,
	.7168786,
	.0606169,
	.0139322,
	.0971045,
	.7141733
];
function w(e) {
	let [t, n, r, i, a, o, s, c, l] = e, u = a * l - o * c, d = -(i * l - o * s), f = i * c - a * s, p = t * u + n * d + r * f;
	return [
		u / p,
		-(n * l - r * c) / p,
		(n * o - r * a) / p,
		d / p,
		(t * l - r * s) / p,
		-(t * o - r * i) / p,
		f / p,
		-(t * c - n * s) / p,
		(t * a - n * i) / p
	];
}
var T = w(C), ee = 216 / 24389, E = 24389 / 27, D = Math.cbrt(ee);
function te(e, t) {
	return [
		e[0] * t[0] + e[1] * t[1] + e[2] * t[2],
		e[3] * t[0] + e[4] * t[1] + e[5] * t[2],
		e[6] * t[0] + e[7] * t[1] + e[8] * t[2]
	];
}
var O = (e) => e > .008856451679035631 ? Math.cbrt(e) : (E * e + 16) / 116, k = (e) => e > D ? e * e * e : (116 * e - 16) / E;
function ne(e) {
	let t = te(C, e), n = O(t[0] / S[0]), r = O(t[1] / S[1]), i = O(t[2] / S[2]);
	return [
		116 * r - 16,
		500 * (n - r),
		200 * (r - i)
	];
}
function re([e, t, n]) {
	let r = (e + 16) / 116, i = t / 500 + r, a = r - n / 200;
	return te(T, [
		k(i) * S[0],
		k(r) * S[1],
		k(a) * S[2]
	]);
}
function ie(e) {
	return ne([
		b(e[0]),
		b(e[1]),
		b(e[2])
	]);
}
function ae(e) {
	let t = re(e);
	return [
		x(t[0]),
		x(t[1]),
		x(t[2])
	];
}
//#endregion
//#region src/patches.ts
var A = Object.freeze({
	L: {
		min: -100,
		max: 200
	},
	ab: {
		min: -256,
		max: 256
	},
	C: {
		min: -128,
		max: 128
	}
}), j = 128, oe = .01, se = 1e-4, M = (e, t, n) => e > n ? n : e < t ? t : e, N = (e) => Math.sqrt(e[1] * e[1] + e[2] * e[2]);
function ce(e, t, n) {
	let { source: r, target: i } = e.patches[t];
	return n ? {
		L: i[0],
		a: i[1],
		b: i[2],
		C: N(i)
	} : {
		L: i[0] - r[0],
		a: i[1] - r[1],
		b: i[2] - r[2],
		C: N(i) - N(r)
	};
}
function P(e, t, n) {
	return t < 0 || t >= e.patches.length ? e : { patches: e.patches.map((e, r) => r === t ? {
		source: e.source,
		target: n(e)
	} : e) };
}
var le = (e, t, n, r) => P(e, t, ({ source: e, target: t }) => [
	r ? n : e[0] + n,
	t[1],
	t[2]
]), ue = (e, t, n, r) => P(e, t, ({ source: e, target: t }) => [
	t[0],
	M(r ? n : e[1] + n, -128, j),
	t[2]
]), de = (e, t, n, r) => P(e, t, ({ source: e, target: t }) => [
	t[0],
	t[1],
	M(r ? n : e[2] + n, -128, j)
]), fe = (e, t, n, r) => P(e, t, ({ source: e, target: t }) => {
	let i = Math.max(se, N(t)), a = M(r ? n : N(e) + n, oe, j);
	return [
		t[0],
		M(t[1] * a / i, -128, j),
		M(t[2] * a / i, -128, j)
	];
}), pe = (e, t) => P(e, t, ({ source: e }) => e);
function me(e, t) {
	return t < 0 || t >= e.patches.length ? e : { patches: e.patches.filter((e, n) => n !== t) };
}
var he = ({ source: e, target: t }) => Math.abs(t[0] - e[0]) > 1e-5 || Math.abs(t[1] - e[1]) > 1e-5 || Math.abs(t[2] - e[2]) > 1e-5;
function ge(e) {
	return e > 24 ? {
		cols: 7,
		rows: 7
	} : {
		cols: 6,
		rows: 4
	};
}
var F = (e, t) => (e[0] - t[0]) ** 2 + (e[1] - t[1]) ** 2 + (e[2] - t[2]) ** 2;
function _e(e, t) {
	if (e.patches.length === 0) return null;
	let n = 0;
	for (let r = 1; r < e.patches.length; r++) F(t, e.patches[r].source) < F(t, e.patches[n].source) && (n = r);
	return n;
}
function ve(e, t, n) {
	if (n.some((e) => Math.abs(e) <= .001) || e.patches.some(({ source: e }) => e.every((e, t) => Math.abs(n[t] - e) < .001))) return null;
	let r = {
		source: n,
		target: n
	}, i = e.patches.length;
	return i < 49 && (t < 0 || t >= i) ? {
		params: { patches: [...e.patches, r] },
		index: i
	} : t < 0 || t >= i ? null : {
		params: { patches: e.patches.map((e, n) => n === t ? r : e) },
		index: t
	};
}
//#endregion
//#region src/rt.ts
var I, L;
function ye(e) {
	L = e, I = e.react;
}
//#endregion
//#region src/Grid.tsx
var be = (e) => `rgb(${ae(e).map((e) => Math.round(255 * Math.min(1, Math.max(0, e)))).join(", ")})`, R = (e) => e.toFixed(2), xe = "Patches with an outline have been moved. Click to select, double-click to reset, right-click to delete; with the picker on, Shift+click puts the picked colour here.";
function Se({ params: e, selected: t, picked: n, onSelect: r, onEdit: i }) {
	let a = e.patches.length, { cols: o, rows: s } = ge(a), c = (o) => {
		let s = o < a ? e.patches[o] : null, c = s ? `L ${R(s.source[0])}  a ${R(s.source[1])}  b ${R(s.source[2])}\n${xe}` : xe, l = (t) => {
			if (t.shiftKey && n) {
				let t = ve(e, o, n);
				if (!t) return;
				r(t.index), i(t.params, "picked patch");
			} else a > 0 && r(Math.min(o, a - 1));
		}, u = () => {
			s && i(pe(e, o), "reset patch");
		}, d = (t) => {
			t.preventDefault(), s && i(me(e, o), "delete patch");
		}, f = s !== null && he(s), p = s && o === t ? s.source[0] > 80 ? "#000" : "#fff" : null;
		return /* @__PURE__ */ I.createElement("div", {
			key: o,
			role: "button",
			"aria-label": s ? `Patch ${o + 1}` : "Empty cell",
			"aria-pressed": s ? o === t : void 0,
			"data-altered": f ? "true" : void 0,
			title: c,
			onClick: l,
			onDoubleClick: u,
			onContextMenu: d,
			style: {
				position: "relative",
				background: s ? be(s.source) : "transparent",
				boxShadow: f ? "inset 0 0 0 2px rgb(204, 204, 204), inset 0 0 0 3px rgb(51, 51, 51)" : void 0,
				cursor: "pointer"
			}
		}, p ? /* @__PURE__ */ I.createElement("div", { style: {
			position: "absolute",
			inset: 4,
			border: `2px solid ${p}`,
			pointerEvents: "none"
		} }) : null);
	};
	return /* @__PURE__ */ I.createElement("div", {
		role: "group",
		"aria-label": "Patches",
		style: {
			display: "grid",
			gridTemplateColumns: `repeat(${o}, 1fr)`,
			gridTemplateRows: `repeat(${s}, 1fr)`,
			gap: 1,
			aspectRatio: `${o} / ${s}`,
			background: "rgb(51, 51, 51)",
			padding: 1
		}
	}, Array.from({ length: o * s }, (e, t) => c(t)));
}
//#endregion
//#region src/params.ts
var Ce = "colour-look-up-table", z = `${Ce}.lab`, we = [
	"active",
	"count",
	"spline",
	"affine",
	"target"
], B = (e) => `${z}.${e}`, V = 75, H = 37, Te = 4;
function Ee(e, t) {
	let n = new Float32Array(e + Te);
	return n[e + 1 + t] = 1, n;
}
function De(e) {
	let t = e.coeff.map((e) => e.every(Number.isFinite));
	if (t.every(Boolean)) return e;
	let [n, r, i] = e.coeff.map((n, r) => t[r] ? n : Ee(e.count, r));
	return {
		...e,
		coeff: [
			n,
			r,
			i
		]
	};
}
var Oe = (e, t) => [...e, ...Array(4 * t - e.length).fill(0)];
function U(e) {
	let t = e.patches.slice(0, 49), n = De(v({ patches: t })), [i, a, o] = n.coeff, s = n.count, c = t.flatMap((e, t) => [
		...e.source,
		i[t],
		a[t],
		o[t]
	]);
	return {
		[B("active")]: +!r({ patches: t }),
		[B("count")]: s,
		[B("spline")]: Oe(c, V),
		[B("affine")]: [
			i,
			a,
			o
		].flatMap((e) => [
			e[s],
			e[s + 1],
			e[s + 2],
			e[s + 3]
		]),
		[B("target")]: Oe(t.flatMap((e) => [...e.target]), H)
	};
}
var ke = (e, t) => Array.isArray(e) && e.length === t && e.every((e) => typeof e == "number" && Number.isFinite(e));
function W(e) {
	let t = e[B("count")], r = e[B("spline")], i = e[B("target")];
	return typeof t == "number" && Number.isInteger(t) && t >= 0 && t <= 49 && ke(r, 4 * V) && ke(i, 4 * H) ? { patches: Array.from({ length: t }, (e, t) => {
		let n = 6 * t, a = 3 * t;
		return {
			source: [
				r[n],
				r[n + 1],
				r[n + 2]
			],
			target: [
				i[a],
				i[a + 1],
				i[a + 2]
			]
		};
	}) } : n;
}
var Ae = () => U(n), je = (e) => ({ patches: e.map((e) => ({
	source: e,
	target: e
})) }), Me = [
	[
		17.46094512939453,
		8.492887496948242,
		-.02357959747314453
	],
	[
		26.878498077392578,
		27.94782829284668,
		14.991056442260742
	],
	[
		34.900054931640625,
		43.8824462890625,
		26.443553924560547
	],
	[
		21.692604064941406,
		16.723676681518555,
		7.39055871963501
	],
	[
		32.18853759765625,
		39.17497253417969,
		23.30967140197754
	],
	[
		62.531227111816406,
		24.966419219970703,
		19.262432098388672
	],
	[
		18.933284759521484,
		8.822664260864258,
		3.136211633682251
	],
	[
		53.93611145019531,
		34.451812744140625,
		31.949621200561523
	],
	[
		69.15426635742188,
		18.39008903503418,
		16.144514083862305
	],
	[
		43.381229400634766,
		28.272598266601562,
		25.8939266204834
	],
	[
		57.797889709472656,
		10.193824768066406,
		12.271202087402344
	],
	[
		73.27630615234375,
		13.241470336914062,
		16.763805389404297
	],
	[
		53.175498962402344,
		43.65530776977539,
		53.904998779296875
	],
	[
		49.11137390136719,
		23.247600555419922,
		36.5373420715332
	],
	[
		63.169830322265625,
		23.308664321899414,
		32.93068313598633
	],
	[
		61.89610290527344,
		11.138319969177246,
		19.008804321289062
	],
	[
		67.85240936279297,
		18.200069427490234,
		32.25922393798828
	],
	[
		72.48951721191406,
		15.363990783691406,
		25.815582275390625
	],
	[
		70.93571472167969,
		11.173545837402344,
		26.509498596191406
	],
	[
		70.17300415039062,
		11.313735961914062,
		40.57270431518555
	],
	[
		77.78826904296875,
		15.059500694274902,
		88.3544692993164
	],
	[
		76.07074737548828,
		4.768699645996094,
		33.43460464477539
	],
	[
		68.64500427246094,
		3.060370683670044,
		9.5750093460083
	],
	[
		74.5029067993164,
		-3.687053918838501,
		41.2851676940918
	]
], Ne = [
	[
		10,
		48,
		16
	],
	[
		20,
		72,
		24
	],
	[
		30,
		72,
		24
	],
	[
		50,
		72,
		24
	],
	[
		70,
		72,
		24
	],
	[
		80,
		72,
		24
	],
	[
		90,
		72,
		24
	],
	[
		10,
		7,
		-25
	],
	[
		20,
		14,
		-50
	],
	[
		30,
		21,
		-75
	],
	[
		50,
		21,
		-75
	],
	[
		70,
		21,
		-75
	],
	[
		80,
		21,
		-75
	],
	[
		90,
		14,
		-50
	],
	[
		10,
		-20,
		16
	],
	[
		20,
		-40,
		32
	],
	[
		30,
		-40,
		32
	],
	[
		50,
		-40,
		32
	],
	[
		70,
		-40,
		32
	],
	[
		80,
		-40,
		32
	],
	[
		90,
		-40,
		32
	],
	[
		63,
		36,
		57
	],
	[
		72,
		19,
		68
	],
	[
		82,
		4,
		80
	],
	[
		72,
		-24,
		57
	],
	[
		43,
		-13,
		22
	],
	[
		71,
		-33,
		0
	],
	[
		51,
		-60,
		-60
	],
	[
		39,
		14,
		14
	],
	[
		65,
		19,
		17
	],
	[
		49,
		-4,
		-23
	],
	[
		55,
		9,
		-25
	],
	[
		52,
		75,
		-21
	],
	[
		31,
		50,
		-50
	],
	[
		41,
		33,
		-66
	],
	[
		17,
		8,
		0
	],
	[
		30,
		9,
		3
	],
	[
		26,
		28,
		15
	],
	[
		32,
		39,
		23
	],
	[
		54,
		34,
		32
	],
	[
		70,
		11,
		41
	],
	[
		76,
		5,
		33
	],
	[
		2,
		0,
		0
	],
	[
		18,
		0,
		0
	],
	[
		34,
		0,
		0
	],
	[
		50,
		0,
		0
	],
	[
		66,
		0,
		0
	],
	[
		82,
		0,
		0
	],
	[
		98,
		0,
		0
	]
], G = 1180;
function K(e) {
	if (e.length !== 2 * G) throw Error(`expected ${2 * G} hex digits, got ${e.length}`);
	let t = new DataView(new ArrayBuffer(G));
	for (let n = 0; n < G; n++) t.setUint8(n, parseInt(e.slice(2 * n, 2 * n + 2), 16));
	let [n, r, i, a, o, s] = [
		0,
		1,
		2,
		3,
		4,
		5
	].map((e) => Array.from({ length: 49 }, (n, r) => t.getFloat32(4 * (e * 49 + r), !0))), c = Math.min(49, Math.max(0, t.getInt32(1176, !0)));
	return { patches: Array.from({ length: c }, (e, t) => ({
		source: [
			n[t],
			r[t],
			i[t]
		],
		target: [
			a[t],
			o[t],
			s[t]
		]
	})) };
}
var Pe = [
	{
		id: "it8-skin-tones",
		label: "IT8 skin tones",
		params: je(Me)
	},
	{
		id: "expanded-checker",
		label: "Expanded colour checker",
		params: je(Ne)
	},
	{
		id: "helmholtz-kohlrausch",
		label: "Helmholtz–Kohlrausch monochrome",
		params: K("9738b84231c098426fb8814234a82d422ac41d422e3fa04100004843f7daa24257e09a422a1a984225113842f89cc9410836ca4295049542ad1c9242887370427cb32b427c512242b5a40742545bd141808740412cc6964262e484429604c44100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ef6d3bc152c2acc1ef6566c093a522c2e7d4e4c1a87c7cc100000000b4c4dd407af09e40d060df418afc7d421dadd0413ec5124097d79041fcba2642fc9f484183eb92415d6b7040fcdcdc41b8fe2f42b64a1740fc8612c1276defc144432ec100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d237eb4022a72842f5639742396d1442a2660d411c338b40000000006e35ca408df2054289658d4132327a4118427741d4cf08c0f8a4d5c03abed7c13fac36c23b41a6c03c2230c07d5088c26caff7c1e0e9c6bff14ecec073b028c29e0accc10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000085f2b642a4ba9a423c9a8442a6493c428baf28425667b64100004843a836a142a84e9b4226719d421cb15d424c22ee4175fcca4211ae96426e6d9a4243878142ef45354222f82542629527420280ff416c2066417e3996420d838e424182e3410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fa370000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c8b700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004837000000000000c8b60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018000000")
	},
	{
		id: "astia",
		label: "Fuji Astia emulation",
		params: K("20f59e427e278d42a2ae6f4218265742c69f4e4282bb1b4200831942eca40942d85cb641000048430000c842083a964214368d42fb258b42928b73424cad4d4231ab3e42093f3c42d38e0c42d828fb412299b841c6e7ad41b2a0a44296dd90422827874224e97c42f4606f425c795b42088b434229b7154206ff1442f61f074229a70442a620fa4120bc9b4160729b41bc109b41ce889441be73904110486e419878b940fa849142fc3c7d42e4d37442aed36f42c5b50d42877d0742e821a0411ae11341a871a4be4a1979c17d9794c18c26ebc17682e8bfec9823c1d2ae6cc03bca04c27ea111c10000000000000000bcda0b3f18478e40040b023f66ca9741097a96413c7eb14104090b41079b0b4236804a423a1624412c95ab41f8e0323f672c684136a909401fb4dc4134380e4188acfe400e6d3e425f60564040228d40b041904176f8dd41127986420bcc2a42b88bc041e7eaa9402ab50341e5f6f841a2dab840333c36426ae64fc106e5aac1a0eac5c19e42babf844ad8c139be78c198f65fc1101fa8bda089444163890b413a7f8a41c748b741979736422c2798413b18fc4024fde6414f3b73410000000000000000fcfb134234fb754246425b4140dc353f4487ce412cf53142ea844d41089ebb41bc42ed411c3d7641af131b41aea35ac0e48351c13f1a92c0b182a7c1892d8ac158c606c2406af6c1992d3ac1dd9ae2c149a950c2c608e7c0c0ff0dc268aaf3c1bf8b90c1aea004c21f564bc2db46c9c0a8a098bf5ee18cc20b3878c18de1d7c1e0c533c142ba1bc1ecd83cc106d411c20603e9c0907a30c0bea4a142fe288c42d48b6042a4c54e42ac414842f68a1542804a1442510b06429c18ac41264845435e58b24213c197428e4b8d4255e18c42ceb17542d0d64042d3293942f92f364293aa0f4296bc0c42b42fb841ceadb441ca69a542e67e984293338742c2248742a8c07c42ee3c6342923a5a429e07184213dc2042d6901f42301d0d42778a2442d6dfd74108a7b541baecc641de56e841bedfb3417a076f41ec9dc24123d19742081185424e427a427c4578424ab81942c07c224200eea94108d1134170d930bfd5e49ac143b4adc1e3180bc2248b4dbf3e6624c13e266bc034f6c6c1f5a3ecc000803bb9008890baf892bf3eb7ffc0400a16fd3f497ab04161009a416eddc941121a0d417b740d42cbf6354235603e4136ce9c41002c493eda48614199e90640ac88f64135230e41a69fac40dbb23c427bce3540a18b4d40f4ce5a41c7b0d84110816b42b4ddf741d01a98418d2510413dcc8b412331bd41efe896407578e64129fd98c1617010c2242005c23e4d85c05be37ac194fa68bf0178d2c028bacc3d46f2674121d83a413a349f416a60d141d6e0264272e8a2417c590f414c1cc241c4df634100e0f63a00b6003c1df73442b2b97442d4d78f41481be73f06bbca41d39c1642f48c674191c5a8414638b9413cc6794191c3354102e024c0262653c11276b8c07a3ad5c1d4d8c1c1e7b039c28ec129c2b5156ec1d82a26c2160a97c2626400c1bec74ac2fe5bf6c1465e87c13ab90dc2c5c47ec2581a2bc038ea0cbf06b38bc2488593c1f8140dc240a6b6c1689254c182c683c13e216cc2a03dd9c0028e10c031000000")
	},
	{
		id: "classic-chrome",
		label: "Fuji Classic Chrome emulation",
		params: K("d303b542eb5a9742ccdd7d4288707142ee9d40427af718427062d641000048430000c8420d96bc42faeaae429c32aa423a6ca9423c9ba7425993a0424e639542788d9242a722894260eb7f42d2876b420c724442dcba4042b6c02b42a8990b421276de41ac68c2410790a542393b9242a7279242a45d8f42a132864230e57e42002145426c3f44428a0b274204e62342b092fd41d68fcd41e02cbb419e07bb41ac2433413247b742a3ad9242006a924293d98142ae892e422cd42642366a26429c7ec44175d738c170f6d7c16fbc62c0116916c25d263dc13639f4c1352ac7c0000000000000000050176d3fe59a98400047863f168f2a401e8d0a41d72e8c418626bb4110dd5341c02f0e4270d9b03ef8c9fd4116fbb9411f8f6542391bfa41a0872f42815d56415e5f06420deec841b2d5b141de5f0841ee252342db21154160bd43405af34f40d5688e42624ea741f1799641242473400a34294238e8114241ee0f41383f184052f118c1724989c18c3c9ec0cf0decc138a006c29d4f65c0ef399fc1ea1696c17ba0f7405e30a741a026964231230042f235c641d6eee641aa7a5a410000000000000000b421d241467c8142ae6de741f7a0ee40a00da9423cb40742d6f24240461c864112558741c9ae1542089484423d261242e79d0a427392c240668cd341d554b241dd0ced40e72188c1091983c1e40b55c1f7b6cdc1304713c2360f12c0b8ca24c06a8319c232e36dc2a96dffc185040ac00e1ae8c1449c95c2c20370c29c0736bf6cce33c12c2200c2d0235cc177a125c2aa6f4fc11aab49c1bcb428c274a900c14babb542f2118d42489f6a42e4de5442c2153142be3202428ef2be4137584743b41ac3428d7dc042f9e4a7422c8fac425b61b04217c69a42d69e9b4255ec974210fa8c4298b687428a7a714282ef5f4292923942805242423c032d4222a90e421665d841a0dbda4154d9aa4255269e425ac99842d51a9a42a8bf8b4244637e42ea414542eac56a4280184042bb6d3542a4070042bf650242a7c111425a620642466841414be5b34248d59042e58c95422ef8814264842c423bef2542bc3f3742e63ac141fb61aac16444c7c1b455523ff40b0ec259efe8c055ec9cc166182cc00000fab800007ab97fc70fc15aec44c1c0eaa4bf4e5fe84072b9f9c0cf0a0041e0859641ac1d5241bb43b641d2a95840ce0bdb41420ca541583e2842c50aba416d47f641188f51410313b5416eec9f41b120c041284ba040a6b2e3417c0ffbbf711224407cdd2f40d2a2364219c555c0daaef1407be03240a8b5b4412e221e402cc6bcbe3067883f51cbc5c1e74603c2d25b09c188a03bc2be01abc1b07bb0c029248cc131a90ac1320d4a41a82c6e416a983f42cd15b741b8ef8941c00e88415aeaee400080ed390010d63a78ed0242dcc74f427ad0de41c023394128677642a7aecb4154458440d4f8504140563b41a9c3e64150812542f354c6414e45ba41bab6c240b6a49241c3a15c412c6e08410c168ec108f28cc1707549c18795ecc1a2b80cc2b861c2bf40480bc035b8d1c13b7a27c2875cb7c18a91acbfc9cd7ac13b382fc27eed03c2003cbe3abf62ecc03433dec17f0a69c1b58ae7c1fc0df5c09cbf17c143b7d6c124d68ac031000000")
	},
	{
		id: "monochrome",
		label: "Fuji Monochrome emulation",
		params: K("287bc242632bb84226d3b54263b1a142befa904280da8942e09a88426c9d67425e6254420abc3042000048438be5aa4213ca99420d748842548c7c42d00a5942a46147422410444227060042b8bfff41348ec742c672b04293a7aa425e7f9d425e779b421a2c9a422b1f9a42fd0b87420a1e7b426e0772429e404a422a3e4a4220fc47423e8d414290c1e8412c6ddd412422cf41cce0b7419cc96441050bc4427c9fc142cebba142dbe0a04224bba04239449f4206e96e42bcec42428292e341b63ed641ca5f2dc02cfe09bfeab32cc0ca08ccc1a49ebbc1640dfcc09c6465bf7de528c2828667c19a8516c2000000002024e040c553d1419ee5594166cd9d4102e2164294636342ae0a19427699cb41a4e0de3e24a60a3fca0aa24112b99040fe569340f8adb441dc810d42aa00f740e048cc3f226070428bc677410000fa3f1053a840e46ed341aea6494144836441a2fd2f42a702824152a14142a2ea103f00e426c1c897d0c1f462f6c1fbfea9c1cb29f1c1175d1ac1efcfb9c1175407c281b891c19ced14c161f0d04192d26b42863e9a41fd251042c58c5041189b884282c51641d981fa416aa89d413b0e1e4100000000ca02b040c8fafa3ffde2b541a4fc0641c47e2e429fb2da404125b14124141a3f7c06a53fc0aae9be3817c0c16f24a8c09a8cabc1e0f6fac154eb25c2927530c2389b4fc1e97a4cc210946ec23e2934c148e702c2400ce8c1257492c2c1fe84c15e791ac2868f90c2599db5c2f66fe9c082aa61c09e38abc0585464bfcec916c2f6cfb8c16b022bc14d3275c26955a0c11a2946c146d9fac1ccf5be428046ac4247acbe4208b697427529894244c87f421ac5874230733d42722546425c5c07426aca474358f8b9421ea1a6427ee58d42e7208842d2416a426a656742fa625742012c0f4280bafb414f0ec542b457bf42a8eab14292dd9c421c95a242e5e4a54279da9942574c8842ff55914222fd7a420e9c4b42f8c44842c2da59421ae935421a45fa4126010c42ecdbd1418a2bd94140c36041ec10bf424b81a9425cfd8f421fa88b42abfb8742d9a9994298f23242ad2f12422a33bd41c8dabb41008ae3bc00b209bc8045e4bc00e87dbb0028a0ba00606aba0028a0ba0000fab700007ab900b0b3390000fa3880fdefbc00d2d7bb00c406bb00f8a7ba007014ba00b033ba0020cbb900a08c390010a43900349ebb8051e2bc003248bc0044c5bb00f6d1bb00ccd8bb00007abb0010a4ba00d004bb003072ba00803bb900007ab90060eab90000fa3700b0b3390010a4390060ea390060ea3900e8003a0007e4bc0008cfbb00a00cbb00940ebb0010a4ba00f47bbb0000fa3700803b390030f2390000fa3920a14f3e8081733de017503e0041eb3c00ec103c0060d13b0012133c0000c8b80020b23a008419bb00001639404f593e00e6433d0094723c0044133c00ec903b000c943b0068583b00040dbb005421bb001d713de0eb4e3ec097b63d00442c3d807d313d005d453d007ee53c004a123c00ca693c00d8d63b0070ad3a0070ad3a00b8533b008009b9001c22bb00e012bb00d04fbb003847bb00b86cbbc0334f3e802f3e3d004e6d3c0038793c0012133c005fe63c008009b90088dbba007c5dbb00705fbb31000000")
	},
	{
		id: "provia",
		label: "Fuji Provia emulation",
		params: K("aa1fae42b13a98429c8997420bbc8f4264bb81424e3f76423a034642de774542b8522142000048430000c8422467bc42f123b2422c209e4282049842fc5b9342567d8b423c50704286f657424e153842deec2f4239fc0d428857de41de0aca414552bd4233bdb342973099428ddb95420af59442f7df9442f0a89442a73d874206ff75428c79704248b5484214c93e42aaee344234af074246a0d04156a284412c803b41f8d7ba4248029d42ddd3964200e884421e123142485c2c42c80e2c42ce24c441ff528ec1f8f123c14b9869c05c0bfdc18c4191bf6dc517c25d1ad6c1f2cd3ec176a711c200000000000000003242bd3fce19a2407cc67a41c7b6784152e27a41982e1142ecbd9f4142e53142f0da7d423b50ff41e574314270501140f6fad04154c232414eef50402f2ce040164c1c4184deb64190aa8f4048930a42bd5d46409d2f6642a6bd4841704e5c40e18dd441b6b79a42ca88dc41ee6e5542333e7d413cc16d3e39061ec16f90cec1c6736ac1143cefc14e0ad8c180ce9dc181d75dc0f5da2dc1b2ce4141fd67a4414d0d26427e43c6419a48664289f20042a8713f42c7dbc441c3dd52410000000000000000a1cd1242fab58242300db2427767e94004a1cd41aa56844166861442a95c5542b9287a41c117b340f682cb414e54c440fdeb76411c4c0bc1469f58c0cce3f0c1537f02c1c7768ac13a0a9ec1d151cdc1a43e47c0946b09c2e9b036c2b8de42c0a5de98c15c0722c2934588c22a7911c2ef9cddc1377a1ec072313dc18f46f2c125f1f7c0acb628c2367522c1fe682bc2c68d55c1af28ccc1ff7ab44211c69742e6f08d42e2918942b03c7842061e6c4265603b42dd9f3942ae882142cc0e48430e6dc842e4f5c2429960b942005490427ab3994210e68c4225cc86427ea6664270774a42fcf6394250a931427a111642226bce41de78d441963fc3425c07b44204ad9b42b72d9d42f9cb9f42d1f59c42bd9c9c4221488742c23a854240d87f4264c648426cb54a4264ce5642f4d92d429ef80d42accba741007f3b4154cabc42993ba44260959b422b7396421c5a3742f48a4a42397a2c429c51e14190161fc222ff73c16fe39dc0cbbd33c2e00058bffabb4bc283daf8c181095ac138a6f4c10000fa3800007a386881b1c15b5c03c24454f83f04aaa64170cd9141ca3cd641a618bc415d2c2042e1bf5542fd60054232552a42b6da20408ab1c14178bfa140f258b440c0e3ba3d66036e414efafa41aa6a3340158303424c05fe3fcbf3344231607a40a2e66440a045da4109637d425dbb6741f4002542b7c23141b018ff3d9b08fac10b2f6cc231a3c3c11e1a72c21ceed2c1b33887c1346393c0d2a38ac0c4c7b9416c71c34101e52d4208cce641b8fd5842397b14429dda1b42e4a2c841aab68d41000048b8000016b9a12f504214e69c422a9e8d42e6791241c41ed941b39a4a417a52144297102642dc4e2b41a152ca40086ac441748eb3404a6369413aac87c09cef18c1bb1805c2be0f4bc1a7bce6c1bc6701c26233f4c1b6b040c0909a26c2c2e040c290ca65c0aaa4b2c1bce85ac2df088fc2423808c2f7d5b5c1255fbcbfd0ad1cc1eef8eac10e2832c18df519c2df67f4c0accb37c26cf164c1f460a3c131000000")
	},
	{
		id: "velvia",
		label: "Fuji Velvia emulation",
		params: K("3f259c42b92693425c7b83420e107d42f86e4f4252a94b4293c32042db870442269da341000048430000c8427ee97f42ceca7342e81e6b42c9eb3e425514254248600f42c0fc0242ea69e941022bcd414624994222cb8d42f57d8842d77587428cea6e421c546c42b2a668429eda5e42da4a5e42242f2f42f37a1542c0fd0d42d0e30842867bab414eeca34154c46941482b5f41d08646415e552c41c512a5423390964242c7914260c07e42ea6176429c79744286010e4273310b42d6a28541fa0a4a41ca2161c0af9206c045d4f4c07ec5c3c1633ccec0d57efac17e2981c1f8449ec112a734c00000000000000000ad5fd440cb8a9441e0fab740a649a941f85d6b41387b2541888d2e42853cc241c33ad0406843c4408eb22d41c016713d7fd79541da99953f7d70c241ba600142f0d0273fd25e0541ceda4e42456b944138a29d41f76448424a941c41d0cc1642a54ba0412c030c428342874106e0e54032bfbdbfab3a48c13fe059c1d141a0c1e655c1c1ac9c49c190d038c1e3c242c094c185c0217c5ac075074e410485174251beb941c0c422412bf53c4282ada0410571a64130a5d93f584cab3e000000000000000004d88f4229c6ba4053185a41e8d51f4268579f41302c503f87e59a410806fe4085f0cf40e67992c190b1ccc0e75c45c19ee3d1c16677a1c11b6e81c1461c06c26c192cc1ef3128c2378125c29272b0c142de69c2154e7bc120564cc2d4a807c2aa6f15c12e2e82c20fa010c200327cc1fe8a4dc1502e4cc0a6debec11a4609c230e38cc112a5c5c042f01dc2b4aa7ec1fd3986c15abf8dc0282aa242f202994250707d429aed7b42604a51424c8b4e42efac1f4276070e426420a441d3d84443567fae4219ce83425a567b4214286242a8554642f1421e42c3f10d427cab1c426af6f5416221ce416de0a14206bf9242de7e8842d21d9142668d7d42465c7e42acb57c428ada5e42f4516242eaf9514232971f42c7522042028e2b42747af9410c8aef4158809141603adb4150e2a7411e1815413287a7429d2d9a420bea9c429a418d428ea5864280877f42687f3142e5cb0f42d85b9f4160000d41c30fbec0b4246fc03f0f46c19b1c1ac2f36b08c1f2513cc2b239b4c196fda7c1123632c000409cb90010a4ba349c76416a78ea410249f3404dfd00427f41974148854d4140604c42c70edc413bf6064131cc684008178941bcb2653fa9edaf4160fe4d40b8121a4222fd2a420238c03fd436d8405e0577429e85bb41f7b899419b5469426c50c541f7e217425da58e41c99c1442ef1690417ac27e416b5e56c0a5d1a5c12405f6c12c5e1bc26ab106c2c5a59ec142693dc0f43a11c082d65140698887c0efab9c41c5de6842b0e8054221f29041eeab36420440f241673fc6410201b4404822063f00e0123b001a1a3ce60f8242e6631e41ef649b41813329425bfeb741fea0973ff9f8d0419a453f41362007412eee15c128293fc18667b0c12eb0acc14bb20fc213a7ebc1281c0dc29cd587c1f61739c2f7974cc2ac6c08c2003c8fc2389bb6c119b5a2c214a74ec266f4ecc05264b6c2107819c2f476a9c17398a8c05af39dc02d6e5cc16d31cec11095f4c1fe9e20c1bfbd76c2d3adc1c12fea7fc196bf11c131000000")
	}
], q = null;
function Fe() {
	q = L.stores.create((e) => ({
		patch: 0,
		absolute: !1,
		picking: !1,
		picked: null,
		setPatch: (t) => e({ patch: t }),
		setAbsolute: (t) => e({ absolute: t }),
		setPicking: (t) => e(t ? { picking: t } : {
			picking: t,
			picked: null
		}),
		setPicked: (t) => e({ picked: t })
	}));
}
function J() {
	if (!q) throw Error("[colour-look-up-table] store() called before activate()");
	return q;
}
//#endregion
//#region src/Panel.tsx
var Ie = "linear-gradient(to right, rgb(0, 255, 51), rgb(255, 255, 255), rgb(255, 0, 51))", Le = "linear-gradient(to right, rgb(0, 0, 255), rgb(255, 255, 255), rgb(255, 255, 0))", Re = [{
	value: "relative",
	label: "Relative"
}, {
	value: "absolute",
	label: "Absolute"
}], Y = {
	patch: "The patch to edit. With the picker on, click the photo to select the patch nearest that colour.",
	picker: "Pick a colour from the photo: selects the nearest patch, and Shift+click on the chart puts the colour on a patch. Esc ends.",
	L: "The target's lightness: lower darkens the patch's colour, higher brightens it.",
	a: "The target's green-magenta: lower shifts the patch's colour towards green, higher towards magenta.",
	b: "The target's blue-yellow: lower shifts the patch's colour towards blue, higher towards yellow.",
	C: "The target's saturation: scales its green-magenta and blue-yellow together, keeping the hue.",
	target: "Relative: the sliders show how far the target is from the patch's colour. Absolute: they show the target's Lab values."
};
function ze() {
	let { useEffect: e, useRef: t } = I, { Slider: n, PickerIcon: r } = L.components, { Button: i, Field: a, Row: o, Select: s, Stack: c } = L.ui, l = L.develop.useParamScope(), u = J()((e) => e.patch), d = J()((e) => e.absolute), f = J()((e) => e.picking), p = J()((e) => e.picked), m = L.develop.usePickDragHeld(), h = l.maskId !== null, g = W(l.getParams()), _ = () => W(l.getParams()), v = (e) => l.setParams(U(e)), y = (e) => l.commit(`Colour Look Up Table ${e}`), b = t(null);
	e(() => {
		if (!h) return () => J().getState().setPicking(!1);
	}, [h]), e(() => {
		!h && f && !m && J().getState().setPicking(!1);
	}, [
		h,
		f,
		m
	]);
	let x = g.patches.length, S = Math.min(u, x - 1), C = S >= 0 ? ce(g, S, d) : null, w = S >= 0 ? g.patches[S].source : null, T = (e, t, r, i, a, o, s) => /* @__PURE__ */ I.createElement("div", { title: t }, /* @__PURE__ */ I.createElement(n, {
		label: e,
		value: r,
		min: i.min,
		max: i.max,
		step: .01,
		defaultValue: a,
		trackBackground: s,
		onChange: (e) => v(o(_(), S, e, d)),
		onCommit: () => y(e.toLowerCase())
	}));
	return /* @__PURE__ */ I.createElement(c, {
		gap: 6,
		style: { padding: 8 }
	}, /* @__PURE__ */ I.createElement(s, {
		ariaLabel: "Colour Look Up Table preset",
		value: "",
		placeholder: "Presets",
		options: Pe.map((e) => ({
			value: e.id,
			label: e.label
		})),
		onChange: (e) => {
			let t = Pe.find((t) => t.id === e);
			t && (v(t.params), y(`preset: ${t.label}`));
		}
	}), /* @__PURE__ */ I.createElement(Se, {
		params: g,
		selected: S,
		picked: h ? null : p,
		onSelect: (e) => J().getState().setPatch(e),
		onEdit: (e, t) => {
			v(e), y(t);
		}
	}), C && w ? /* @__PURE__ */ I.createElement(I.Fragment, null, /* @__PURE__ */ I.createElement(o, {
		gap: 6,
		align: "center"
	}, /* @__PURE__ */ I.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ I.createElement(s, {
		ariaLabel: "Patch",
		title: Y.patch,
		value: String(S),
		options: g.patches.map((e, t) => ({
			value: String(t),
			label: `Patch ${t + 1}`
		})),
		onChange: (e) => J().getState().setPatch(Number(e))
	})), h ? null : /* @__PURE__ */ I.createElement(i, {
		size: "sm",
		active: f,
		title: Y.picker,
		"aria-label": "Pick a colour",
		"aria-pressed": f,
		onClick: () => J().getState().setPicking(!f)
	}, /* @__PURE__ */ I.createElement(r, { size: 12 }))), T("Lightness", Y.L, C.L, A.L, d ? w[0] : 0, le), T("Green-magenta offset", Y.a, C.a, A.ab, d ? w[1] : 0, ue, Ie), T("Blue-yellow offset", Y.b, C.b, A.ab, d ? w[2] : 0, de, Le), /* @__PURE__ */ I.createElement("div", { title: Y.C }, /* @__PURE__ */ I.createElement(n, {
		label: "Saturation",
		value: C.C,
		min: A.C.min,
		max: A.C.max,
		step: .01,
		defaultValue: d ? Math.hypot(w[1], w[2]) : 0,
		onChange: (e) => {
			b.current ??= _(), v(fe(b.current, S, e, d));
		},
		onCommit: () => {
			b.current = null, y("saturation");
		}
	})), /* @__PURE__ */ I.createElement(a, { label: "Target colour" }, /* @__PURE__ */ I.createElement(s, {
		ariaLabel: "Target colour",
		title: Y.target,
		value: d ? "absolute" : "relative",
		options: Re,
		onChange: (e) => J().getState().setAbsolute(e === "absolute")
	}))) : null);
}
//#endregion
//#region src/picker.ts
var Be = Object.freeze({ [B("active")]: 0 });
async function Ve(e) {
	try {
		let t = L.stores.useDevelopStore.getState().photoId, n = await L.develop.sampleView(e, Be), r = J().getState(), i = L.stores.useDevelopStore.getState();
		if (!n || !r.picking || i.photoId !== t) return;
		let a = ie(n);
		r.setPicked(a);
		let o = _e(W(i.paramBag), a);
		o !== null && r.setPatch(o);
	} catch (e) {
		console.warn("[colour-look-up-table] pick failed:", e);
	}
}
var He = { onPress: (e) => void Ve(e) };
function Ue() {
	return J().subscribe((e, t) => {
		e.picking !== t.picking && L.develop.setPickDrag(e.picking ? He : null);
	});
}
//#endregion
//#region src/stage.ts
function X(e) {
	let t = e.toPrecision(10);
	return t.includes("e") ? e.toExponential(9) : t.includes(".") ? t : `${t}.0`;
}
function We(e) {
	return `mat3(${[
		0,
		3,
		6,
		1,
		4,
		7,
		2,
		5,
		8
	].map((t) => X(e[t])).join(", ")})`;
}
var Ge = String(V / 3), Ke = X(ee), qe = X(D), Je = X(E), Ye = `vec3(${S.map(X).join(", ")})`, Z = {
	scale: X(o.scale),
	bias: X(o.bias),
	a: X(o.a),
	b: X(o.b),
	c: X(o.c)
}, Xe = `
vec3 clDecode(vec3 y) {
  vec3 m = abs(y);
  return sign(y) * mix(m / 12.92, pow((m + 0.055) / 1.055, vec3(2.4)), step(0.04045, m));
}
vec3 clEncode(vec3 x) {
  vec3 m = abs(x);
  return sign(x) * mix(m * 12.92, 1.055 * pow(m, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, m));
}
float clF(float t) {
  return t > ${Ke} ? pow(t, 1.0 / 3.0) : (${Je} * t + 16.0) / 116.0;
}
float clFInv(float v) {
  return v > ${qe} ? v * v * v : (116.0 * v - 16.0) / ${Je};
}
vec3 clLab(vec3 rgb) {
  const mat3 toXyz = ${We(C)};
  vec3 r = (toXyz * rgb) / ${Ye};
  vec3 v = vec3(clF(r.x), clF(r.y), clF(r.z));
  return vec3(116.0 * v.y - 16.0, 500.0 * (v.x - v.y), 200.0 * (v.y - v.z));
}
vec3 clRgb(vec3 lab) {
  const mat3 toRgb = ${We(T)};
  float fy = (lab.x + 16.0) / 116.0;
  float fx = lab.y / 500.0 + fy;
  float fz = fy - lab.z / 200.0;
  return toRgb * (vec3(clFInv(fx), clFInv(fy), clFInv(fz)) * ${Ye});
}

// darktable's fastlog2: the float's bits read as an integer give its
// exponent, and a rational fit of the mantissa does the rest.
highp float clFastLog2(highp float x) {
  highp uint bits = floatBitsToUint(x);
  highp float mx = uintBitsToFloat((bits & 0x007FFFFFu) | 0x3F000000u);
  highp float y = float(bits) * ${Z.scale};
  return y - ${Z.bias} - ${Z.a} * mx - ${Z.b} / (${Z.c} + mx);
}

// One output channel's affine part: the constant, then the L, a and b terms,
// summed in darktable's order.
highp float clAffine(highp vec4 r, highp vec3 x) {
  return r.x + ((r.y * x.x + r.z * x.y) + r.w * x.z);
}

// The thin-plate radial function r² ln r², floored inside the logarithm.
highp float clKernel(highp vec3 x, highp vec3 y) {
  highp vec3 d = x - y;
  highp float r2 = d.x * d.x + d.y * d.y + d.z * d.z;
  return r2 * (${X(s)} * clFastLog2(max(${X(c)}, r2)));
}
`, Ze = `
{
  if (active != 0) {
    highp vec3 clIn = clLab(clDecode(c));
    highp vec3 clOut = vec3(clAffine(affine[0], clIn), clAffine(affine[1], clIn), clAffine(affine[2], clIn));
    for (int clP = 0; clP < ${Ge}; clP++) {
      if (2 * clP >= count) break;
      highp vec4 clA = spline[3 * clP];
      highp vec4 clB = spline[3 * clP + 1];
      highp vec4 clC = spline[3 * clP + 2];
      clOut += vec3(clA.w, clB.xy) * clKernel(clIn, clA.xyz);
      clOut += clC.yzw * clKernel(clIn, vec3(clB.zw, clC.x));
    }
    c = clEncode(clRgb(clOut));
  }
}
`, Qe = {
	active: {
		glslType: "int",
		range: {
			min: 0,
			max: 1,
			step: 1
		}
	},
	count: {
		glslType: "int",
		range: {
			min: 0,
			max: 49,
			step: 1
		}
	}
}, $e = {
	active: "active",
	count: "patches",
	spline: "patches and their weights",
	affine: "mapping base",
	target: "target colours"
}, et = {
	spline: V,
	affine: 3,
	target: H
};
function tt() {
	let e = U(n);
	return we.map((t) => {
		let n = e[B(t)], r = $e[t], i = Qe[t];
		return i ? {
			key: t,
			glslType: i.glslType,
			default: n,
			label: r,
			range: i.range
		} : {
			key: t,
			glslType: "vec4",
			length: et[t],
			default: n,
			label: r
		};
	});
}
function nt() {
	return {
		id: z,
		name: "Colour Look Up Table",
		phase: "display-adjust",
		priority: 90,
		space: { encoding: "perceptual" },
		glsl: Ze,
		helpers: Xe,
		uniforms: tt(),
		presetScope: "global",
		mask: { maskable: !0 },
		dormantWhen: { active: 0 }
	};
}
//#endregion
//#region src/index.tsx
var rt = `${Ce}.panel`, Q = null, $ = null;
function it() {
	let e = L.stores.useDevelopStore.getState();
	e.setDynParams(Ae()), e.commitEdit("Colour Look Up Table reset");
}
function at(e) {
	ye(e), Fe(), Q = e, $ = Ue(), e.registerProcessingStage(nt()), e.registerPanel({
		id: rt,
		title: "Colour Look Up Table",
		component: ze,
		defaultDock: {
			module: "develop",
			direction: "right",
			width: 268
		},
		modules: ["develop"],
		onReset: it,
		mask: {
			component: ze,
			owns: we.map(B)
		}
	});
}
function ot() {
	let e = Q;
	if (e) {
		Q = null;
		try {
			J().getState().setPicking(!1), $?.(), $ = null, e.develop.setPickDrag(null), e.unregisterProcessingStage(z);
		} catch (e) {
			console.warn("[colour-look-up-table] deactivate failed:", e);
		}
	}
}
//#endregion
export { rt as PANEL_ID, at as activate, ot as deactivate };

//# sourceMappingURL=index.js.map