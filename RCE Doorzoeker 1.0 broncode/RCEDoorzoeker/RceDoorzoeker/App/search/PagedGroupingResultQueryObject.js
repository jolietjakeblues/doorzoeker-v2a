var search = angular.module('Search');

search.factory('PagedGroupingResultQueryObject', [ 'PagingSet', function (PagingSet) {
	var nr_of_displayed_pages = 5;
	var items_per_page = 10;

	function PagedGroupingResultQueryObject(groupUri, queryCb, loadingItems) {

		if (typeof (queryCb) !== 'function') {
			throw "PagedGrouping needs a query callback function";
		}

		this.loadingItems = loadingItems;
		this.queryCb = queryCb;
		this.groupUri = groupUri;

		this.pagingSet = new PagingSet(nr_of_displayed_pages);

		this.start = 0;
		this.count = items_per_page;

		this.numberOfPages = null;
		this.pages = null;
		this.currentPage = 0;
		this.items = null;
	}

	PagedGroupingResultQueryObject.prototype = {
		setItems: function(data) {
			// configure paging set
			this.currentPage = Math.floor(data.start / items_per_page) + 1;
			this.numberOfPages = Math.ceil(data.totalCount / items_per_page);

			this.start = (this.currentPage - 1) * items_per_page;

			this.configurePagingSet();

			this.items = data.items;
		},
		isCurrentPage: function(index) {
			return index === this.currentPage;
		},
		gotoPage: function(link) {
			if (!link) {
				return false;
			}

			console.log('paging to page ' + link);
			this.currentPage = link;

			this.start = items_per_page * (link - 1);

			this.queryItems();
			return false;
		},
		configurePagingSet: function() {

			var pages = this.pagingSet.assemblePagingSet(this.currentPage, this.numberOfPages);

			if (pages.length > 3) {
				this.pages = pages;
			} else {
				this.pages = null;
			}
		},
		queryItems: function() {

			console.log('launching item query');
			this.loadingItems.loading = true;

			var that = this;
			return this.queryCb(this.groupUri, this.start, this.count)
				.success(function(data) {
					that.setItems(data);
				})
				.finally(function() {
					that.loadingItems.loading = false;
				});
		},
		hasLoaded: function() {
			return this.items !== null;
		},

	};

	return PagedGroupingResultQueryObject;
}]);