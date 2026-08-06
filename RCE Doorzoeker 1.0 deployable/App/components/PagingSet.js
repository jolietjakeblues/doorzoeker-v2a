var components = angular.module('Components');

components.factory('PagingSet', function() {

	function PagingSet(numberOfDisplayedPages) {
		this.numberOfDisplayedPages = numberOfDisplayedPages;
	}

	PagingSet.prototype.defaultPreviousPage = function() {
		return { caption: "<", link: null };
	};

	PagingSet.prototype.defaultNextPage = function() {
		return { caption: ">", link: null };
	};

	PagingSet.prototype.assemblePagingSet = function(currentPage, numberOfTotalPages) {

		if (!(numberOfTotalPages >= 0)) {
			throw "number of pages not set, can't configure paging set";
		}

		if (numberOfTotalPages === 0) {
			return [];
		}

		var firstDisplayedPage;
		var nrOfPages;

		if (numberOfTotalPages <= this.numberOfDisplayedPages) {
			nrOfPages = numberOfTotalPages;
			firstDisplayedPage = 1;
		} else {
			nrOfPages = this.numberOfDisplayedPages;
			firstDisplayedPage = currentPage - Math.floor(this.numberOfDisplayedPages / 2);
			if (firstDisplayedPage <= 0) {
				firstDisplayedPage = 1;
			} else {
				// don't extend past the last page
				firstDisplayedPage = Math.min(firstDisplayedPage, (numberOfTotalPages - this.numberOfDisplayedPages) + 1);
			}
		}

		var pages = new Array(nrOfPages + 2);
		for (var i = 0; i < nrOfPages; i++) {
			var pageLink = firstDisplayedPage + i;
			pages[i + 1] = {
				caption: pageLink.toString(),
				link: pageLink
			};
		}

		if (currentPage > 1) {
			// previous
			pages[0] = {
				caption: "<",
				link: currentPage - 1
			};
		} else {
			pages[0] = this.defaultPreviousPage();
		}

		if (currentPage < numberOfTotalPages) {
			// next
			pages[nrOfPages + 1] = {
				caption: ">",
				link: currentPage + 1
			};
		} else {
			pages[nrOfPages + 1] = this.defaultNextPage();
		}

		return pages;
	};

	return PagingSet;
});
