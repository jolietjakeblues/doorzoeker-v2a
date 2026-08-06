
angular.module("Components")
	.directive("dzResourceValue", [
		'itemClassifier',
		function (itemClassifier) {
			function isLink(label) {
				return /^https?:\/\//.test(label);
			}

			return {
				restrict: 'A',
				scope: {
					resource: "=",
				},
				link: function (scope, element) {
					var resource = scope.resource;
					if (resource.isUnresolved) {
						element
							.append('<span class="unresolved" data-qtip="Kan item niet vinden" data-unresolved="true" data-uri="' + resource.label + '" }>' + resource.label + '</span>');
					} else {
						if (!resource.link) {
							if (isLink(resource.label)) {
								element
									.append('<a class="extern" target="_blank" href="' + resource.label + '">' + resource.label + '</a>');
							} else {
								element
									.append(resource.label);
							}
						} else {
							var cssClass = itemClassifier.determineCssClass(resource.classification);
							if (resource.isInRecycleBin) {
								element
									.append('<span class="resource-link ' + cssClass + '"><a class="sitelink" href="/#/item?uri=' + resource.link + '" data-uri="' + resource.link + '" data-qtip="Item bevindt zich in de prullenbak" data-inrecyclebin="true">' + resource.label + '</a></span>');
							} else {
								element
									.append('<span class="resource-link ' + cssClass + '"><a class="sitelink" href="/#/item?uri=' + resource.link + '" data-uri="' + resource.link + '">' + resource.label + '</a></span>');
							}
						}
					}
				},
			};
		}
	]);
