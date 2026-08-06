
angular.module('App')
	.controller('AppController', ['$scope', function ($scope) {
		var facet_values_per_page = 3;

		function defaultSearchSpec() {
			return {
				query: "",
				facetOn: [],
				facetExpansion: null,
				facetCount: facet_values_per_page,
				groupBy: { type: 'structure' },
				view: 'list'
			};
		}

		$scope.appstate = {
			navigating: false
		};

		$scope.searchSpec = defaultSearchSpec();

		$scope.defaultSearchSpec = defaultSearchSpec;

		$scope.resetSearch = function () {
			$scope.searchSpec = defaultSearchSpec;
		};

		console.log('App controller initialized.');
	}
	]);