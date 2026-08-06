
angular.module("Item")
	.directive('dzItemImages', ['PagingSet', '$http', '$location', '$compile', function (PagingSet, $http, $location, $compile) {
	
	var nr_of_displayed_pages = 5;
	var items_per_page = 9;

	return {
		restrict: 'E',
		scope: true,
		replace: true,
		templateUrl: '/App/item/directives/itemImages.html',
		link: function($scope) {

			$scope.loading = true;
			$scope.uri = $scope.$parent.uri;

			$scope.start = $location.search.start || 0;
			$scope.count = $location.search.count || items_per_page;

			$scope.pages = null;
			$scope.images = null;

			var pagingSet = new PagingSet(nr_of_displayed_pages);

			function loadImages() {
				$scope.loading = true;
				$http.get('item/ListImages?uri=' + $scope.uri + '&start=' + $scope.start + '&count=' + $scope.count)
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

				$scope.images = data.items;
			}

			$scope.gotoPage = function(link) {
				if (!link) {
					return false;
				}
				console.log('paging to item images page ' + link);
				$scope.currentPage = link;

				$scope.start = items_per_page * (link - 1);

				loadImages();

				return false;
			};

			$scope.showImage = function(image) {
				console.log("Showing img:" + image.url);
				
				if (!$scope.lightbox) {
					$http.get('App/item/lightbox.html')
						.then(function(response) {
							$scope.lightbox = $compile(response.data);
							$scope.showLightbox(image);
						});
					
				} else {
					$scope.showLightbox(image);
				}
			};

			$scope.showLightbox = function (image) {
				$scope.image = image;
				$scope.lightbox($scope, function (templated) {
					$(document).find('body').append(templated);
				});
				var lightboxElement = $('#imageLightbox');
				lightboxElement
					.modal()
					.on('hidden.bs.modal', function () {
						lightboxElement.remove();
						$scope.image = null;
					});
			};

			loadImages();

		}
	};
	
}]);
