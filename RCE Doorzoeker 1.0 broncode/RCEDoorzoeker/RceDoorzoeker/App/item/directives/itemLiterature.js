
angular.module("Item")
	.directive('dzItemLiterature', ['PagingSet', '$http', '$location', function (PagingSet, $http, $location) {
	
	var nr_of_displayed_pages = 5;
	var items_per_page = 9;

	return {
		restrict: 'E',
		scope: true,
		replace: true,
		templateUrl: '/App/item/directives/itemLiterature.html',
		link: function($scope) {

			$scope.loading = true;
			$scope.uri = $scope.$parent.uri;

			$scope.start = $location.search.start || 0;
			$scope.count = $location.search.count || items_per_page;

			$scope.pages = null;
			$scope.literature = null;

			var pagingSet = new PagingSet(nr_of_displayed_pages);

			function loadLiterature() {
				$scope.loading = true;
				$http.get('item/ListLiterature?uri=' + $scope.uri + '&start=' + $scope.start + '&count=' + $scope.count)
					.success(function(data) {
						setResult(data);
						$scope.loading = false;
				});
			}
			
			function setResult(data) {

				// configure paging set
				$scope.currentPage = Math.floor($scope.start / items_per_page) + 1;
				$scope.numberOfPages = Math.ceil(data.totalCount / items_per_page);

				var pages = pagingSet.assemblePagingSet($scope.currentPage, $scope.numberOfPages);
				if (pages.length > 3) {
					$scope.pages = pages;
				} else {
					$scope.pages = null;
				}

				$scope.literature = data.items;
			}

			$scope.gotoPage = function(link) {
				if (!link) {
					return false;
				}
				console.log('paging to item literature page ' + link);
				$scope.currentPage = link;

				$scope.start = items_per_page * (link - 1);

				loadLiterature();

				return false;
			};
			
			loadLiterature();

		}
	};
	
}]);
