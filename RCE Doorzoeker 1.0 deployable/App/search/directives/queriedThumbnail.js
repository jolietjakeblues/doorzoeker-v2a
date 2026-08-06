var search = angular.module('Search');

search.directive('dzQueriedThumbnail', ['$http',
	function($http) {
		return {
			restrict: 'A',
			scope: {
				resource: "="
			},
			link: function($scope, element) {

				function noImage($element) {
					$element.children("img")
						.attr("src", "/Content/images/geenafbeelding.png")
						.attr("alt", "geen afbeelding beschikbaar");

					removeSpinner($element);
				}

				function removeSpinner($element) {
					setTimeout(function () {
						$element.children('i').remove();
					}, 200);
				}

				var resource = $scope.resource;
				
				if (resource.link) {
					element.append('<i class="loading-thumbnail fa fa-spinner fa-3x fa-spin active" />');

					// query thumbnail
					$http.get("/Item/Thumbnail?uri=" + resource.link)
						.success(function (data) {
							if (data !== "null") {
								// data is returned surrounded with quotes
								var url = data.slice(1, data.length - 1);
								element.children("img")
									.attr("src", url)
									.attr("alt", resource.label);

								removeSpinner(element);
							} else {
								noImage(element);
							}
						})
						.error(function () {
							console.log('thumbnail query returned http error');
							noImage(element);
						}
					);
				} else {
					noImage(element);
				}
			}
		};
	}
]);