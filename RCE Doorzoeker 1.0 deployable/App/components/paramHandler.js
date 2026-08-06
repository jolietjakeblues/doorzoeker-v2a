angular.module("Components").service("paramHandler", [

	

	function () {
		
		// this service contains a copy of the jQuery .params method.
		// this version has the space to + sign replacement removed, which is a pain to work with

		var rbracket = /\[\]$/;
		function buildParams(prefix, obj, add) {
			var name;

			if (jQuery.isArray(obj)) {
				// Serialize array item.
				jQuery.each(obj, function (i, v) {
					if (rbracket.test(prefix)) {
						// Treat each array item as a scalar.
						add(prefix, v);

					} else {
						// Item is non-scalar (array or object), encode its numeric index.
						buildParams(prefix + "[" + (typeof v === "object" ? i : "") + "]", v, add);
					}
				});

			} else if (jQuery.type(obj) === "object") {
				// Serialize object item.
				for (name in obj) {
					buildParams(prefix + "[" + name + "]", obj[name], add);
				}

			} else {
				// Serialize scalar item.
				add(prefix, obj);
			}
		}

		this.param = function (a) {
			var prefix,
				s = [],
				add = function (key, value) {
					// If value is a function, invoke it and return its value
					value = jQuery.isFunction(value) ? value() : (value == null ? "" : value);
					s[s.length] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
				};

			// If an array was passed in, assume that it is an array of form elements.
			if (jQuery.isArray(a) || (a.jquery && !jQuery.isPlainObject(a))) {
				// Serialize the form elements
				jQuery.each(a, function () {
					add(this.name, this.value);
				});

			} else {
				// If traditional, encode the "old" way (the way 1.3.2 or older
				// did it), otherwise encode params recursively.
				for (prefix in a) {
					buildParams(prefix, a[prefix], add);
				}
			}

			// Return the resulting serialization
			return s.join("&");
		};
		
		this.deparam = function (queryString) {
			return $.deparam(queryString);
		}
	}
]);