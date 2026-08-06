var search = angular.module('Search');

search.directive('dzSearchResult', ['$location', 
	function($location) {
		return {
			restrict: 'E',
			templateUrl: "/App/search/directives/searchResult.html",
			scope: {
				groups: "=",
				viewstyle: "=",
			},
			link: function (scope) {
				scope.navigate = function(item) {
					$location.url('/item?uri=' + item.link);
				};
			}
		};
	}
]);