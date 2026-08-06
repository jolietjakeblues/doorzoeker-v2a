var search = angular.module('Search');

search.factory('MapResultQueryObject', function () {

	function MapResultQueryObject(queryCb, loadingItems) {
		if (typeof (queryCb) !== 'function') {
			throw "MapResultQueryObject needs a query callback function";
		}

		this.loadingItems = loadingItems;
		this.queryCb = queryCb;
		
		this.queryResultInfo = '';
		this.queryResultTooLarge = false;
		this.result = null;
	}

	MapResultQueryObject.prototype = {
		setResult: function(result) {
			this.result = result;
		},
		queryItems: function() {
			console.log('launching map item query');
			this.loadingItems.loading = true;

			var that = this;
			return this.queryCb(this.viewport)
				.success(function(data) {

					if (data.tooManyResults) {
						that.queryResultInfo = data.totalCount + " resultaten in deze weergave, teveel om tegelijkertijd weer te kunnen geven. Zoom verder in of vernauw het zoekresultaat.";
						that.queryResultTooLarge = true;
					} else {
						that.queryResultInfo = data.totalCount + " resultaten in deze weergave.";
						that.queryResultTooLarge = false;
					}
					that.setResult(data);
				})
				.finally(function() {
					that.loadingItems.loading = false;
				});
		},
		hasLoaded: function() {
			return this.result !== null;
		},
		viewport: {
			topLeft: { latitude: 0, longitude: 0 },
			bottomRight: { latitude: 0, longitude: 0 }
		}
	};

	return MapResultQueryObject;
});