import{g as c}from"./_commonjsHelpers-D6-XlEtG.js";import{r as m}from"./index-X0XKF-KT.js";function d(o,r){for(var s=0;s<r.length;s++){const e=r[s];if(typeof e!="string"&&!Array.isArray(e)){for(const t in e)if(t!=="default"&&!(t in o)){const n=Object.getOwnPropertyDescriptor(e,t);n&&Object.defineProperty(o,t,n.get?n:{enumerable:!0,get:()=>e[t]})}}}return Object.freeze(Object.defineProperty(o,Symbol.toStringTag,{value:"Module"}))}var _={exports:{}},f={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var y=m,x=Symbol.for("react.element"),j=Symbol.for("react.fragment"),b=Object.prototype.hasOwnProperty,g=y.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,O={key:!0,ref:!0,__self:!0,__source:!0};function a(o,r,s){var e,t={},n=null,p=null;s!==void 0&&(n=""+s),r.key!==void 0&&(n=""+r.key),r.ref!==void 0&&(p=r.ref);for(e in r)b.call(r,e)&&!O.hasOwnProperty(e)&&(t[e]=r[e]);if(o&&o.defaultProps)for(e in r=o.defaultProps,r)t[e]===void 0&&(t[e]=r[e]);return{$$typeof:x,type:o,key:n,ref:p,props:t,_owner:g.current}}f.Fragment=j;f.jsx=a;f.jsxs=a;_.exports=f;var i=_.exports;const l=c(i),v=d({__proto__:null,default:l},[i]),u=l??v,R=u.Fragment,S=u.jsx,k=u.jsxs;export{R as Fragment,u as default,S as jsx,k as jsxs};
