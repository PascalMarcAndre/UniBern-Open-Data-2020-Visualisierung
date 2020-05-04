!function(t,i,e){if("undefined"!=typeof module&&module.exports)module.exports=e(require("heatmap.js"),require("leaflet"));else if("function"==typeof define&&define.amd)define(["heatmap.js","leaflet"],e);else{if(void 0===window.h337)throw new Error("heatmap.js must be loaded before the leaflet heatmap plugin");if(void 0===window.L)throw new Error("Leaflet must be loaded before the leaflet heatmap plugin");i.HeatmapOverlay=e(window.h337,window.L)}}(0,this,function(t,i){"use strict";void 0===i.Layer&&(i.Layer=i.Class);var e=i.Layer.extend({initialize:function(t){this.cfg=t,this._el=i.DomUtil.create("div","leaflet-zoom-hide"),this._data=[],this._max=1,this._min=0,this.cfg.container=this._el},onAdd:function(e){var a=e.getSize();this._map=e,this._width=a.x,this._height=a.y,this._el.style.width=a.x+"px",this._el.style.height=a.y+"px",this._el.style.position="absolute",this._origin=this._map.layerPointToLatLng(new i.Point(0,0)),e.getPanes().overlayPane.appendChild(this._el),this._heatmap||(this._heatmap=t.create(this.cfg)),e.on("moveend",this._reset,this),this._draw()},addTo:function(t){return t.addLayer(this),this},onRemove:function(t){t.getPanes().overlayPane.removeChild(this._el),t.off("moveend",this._reset,this)},_draw:function(){if(this._map){var t=this._map.getPanes().mapPane._leaflet_pos;this._el.style[e.CSS_TRANSFORM]="translate("+-Math.round(t.x)+"px,"+-Math.round(t.y)+"px)",this._update()}},_update:function(){var t,i,e,a={max:this._max,min:this._min,data:[]};if(t=this._map.getBounds(),i=this._map.getZoom(),e=Math.pow(2,i),0!=this._data.length){for(var s=[],h=this.cfg.scaleRadius?e:1,n=0,r=0,l=this.cfg.valueField,d=this._data.length;d--;){var o=this._data[d],_=o[l],m=o.latlng;if(t.contains(m)){n=Math.max(_,n),r=Math.min(_,r);var f,u=this._map.latLngToContainerPoint(m),g={x:Math.round(u.x),y:Math.round(u.y)};g[l]=_,f=o.radius?o.radius*h:(this.cfg.radius||2)*h,g.radius=f,s.push(g)}}this.cfg.useLocalExtrema&&(a.max=n,a.min=r),a.data=s,this._heatmap.setData(a)}else this._heatmap&&this._heatmap.setData(a)},setData:function(t){this._max=t.max||this._max,this._min=t.min||this._min;for(var e=this.cfg.latField||"lat",a=this.cfg.lngField||"lng",s=this.cfg.valueField||"value",h=(t=t.data).length,n=[];h--;){var r=t[h],l={latlng:new i.LatLng(r[e],r[a])};l[s]=r[s],r.radius&&(l.radius=r.radius),n.push(l)}this._data=n,this._draw()},addData:function(t){if(t.length>0)for(var e=t.length;e--;)this.addData(t[e]);else{var a=this.cfg.latField||"lat",s=this.cfg.lngField||"lng",h=this.cfg.valueField||"value",n=t,r={latlng:new i.LatLng(n[a],n[s])};r[h]=n[h],this._max=Math.max(this._max,r[h]),this._min=Math.min(this._min,r[h]),n.radius&&(r.radius=n.radius),this._data.push(r),this._draw()}},_reset:function(){this._origin=this._map.layerPointToLatLng(new i.Point(0,0));var t=this._map.getSize();this._width===t.x&&this._height===t.y||(this._width=t.x,this._height=t.y,this._el.style.width=this._width+"px",this._el.style.height=this._height+"px",this._heatmap._renderer.setDimensions(this._width,this._height)),this._draw()}});return e.CSS_TRANSFORM=function(){for(var t=document.createElement("div"),i=["transform","WebkitTransform","MozTransform","OTransform","msTransform"],e=0;e<i.length;e++){var a=i[e];if(void 0!==t.style[a])return a}return i[0]}(),e});