angular
	.module('Components')
	.directive('dzSearchbox', ['$location', function ($location) {

		var SUGGESTION_LIMIT = 15;

		function initTypeAhead() {
			var engine = new Bloodhound({
				name: 'searchterms',
				limit: SUGGESTION_LIMIT,
				remote: '/Search/TermSuggest?count=' + SUGGESTION_LIMIT * 2 + '&term=%QUERY',
				datumTokenizer: function (d) {
					return Bloodhound.tokenizers.whitespace(d.value);
				},
				queryTokenizer: Bloodhound.tokenizers.whitespace,
				dupDetector: function (left, right) {
					return left.value === right.value;
				}
			});

			engine.initialize();
			return engine;
		}

		return {
			restrict: 'E',
			templateUrl: "/App/components/directives/searchbox.html",
			scope: {
				handler: '&',
				disableThesauriSearch: '=',
				currentQuery: '&'
			},
			link: function ($scope, element, attr) {

				function bindTypeahead() {

					// instantiate the typeahead UI
					$('#search-term-input').typeahead({
						minLength: 2,
						highlight: true,
					},
					{
						displayKey: 'value',
						source: $scope.typeaheadEngine.ttAdapter()
					})
					.bind('typeahead:selected', function (obj, datum) {
						console.log('autocomplete entry selected: ' + datum.value);

						$scope.currentQuery = datum.value;
						// even though launchSearch will use $location this somehow stays under the radar
						$scope.$apply(function () {
							$scope.launchSearch();
						});
					});
				}
				
				var engine = initTypeAhead();
				$scope.typeaheadEngine = engine;

				bindTypeahead();

				$scope.launchSearch = function () {
					element.find('input#search-term-input').typeahead('close');

					if (attr.handler) {
						console.log('invoking search handler with query: ' + $scope.currentQuery);
						// if we are passed a handler delegate the searching to it
						$scope.handler({ query: $scope.currentQuery });
					} else {
						// otherwise trigger a navigation
						$location.url("/search?query=" + $scope.currentQuery);
					}
				};

				$scope.externalSearch = function (destination) {
					function openWindowOrTab(url) {
						var win = window.open(url, '_blank');
						win.focus();
						return false;
					}

					var query = $scope.currentQuery;
					if (destination === 'gahetna') {
						openWindowOrTab("http://gahetna.nl/zoeken/q/zoekterm/" + encodeURIComponent(query));

					} else if (destination === 'dimcon') {
						openWindowOrTab("http://www.digitalecollectienederland.nl/search?query=" + encodeURIComponent(query));
					}

					return false;
				};

				$scope.keyPressed = function (event) {

					if (event.keyCode === 13) {
						this.launchSearch();
					}
				};
			}
		};
	}]);