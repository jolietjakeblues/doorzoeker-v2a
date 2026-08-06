var search = angular.module('Search');

search.factory('Grouping', ['PagedGroupingResultQueryObject', 'MapResultQueryObject', function (PagedGroupingResultQueryObject, MapResultQueryObject) {
	function Grouping(group, $scope) {
		this.group = group;
		this.$scope = $scope; // ToDo: Eliminate this somehow? Use a callback?
		this.expanded = false;
		this.loadingItems = { loading: false }; // ToDo: Is this in use?

		var groupUri = group.groupLabel.link;

		var mapQueryCb = function (viewport) {
			return $scope.mapGroupingQuery(groupUri, viewport);
		}

		this.queryPagedObject = new PagedGroupingResultQueryObject(groupUri, $scope.pagedGroupingQuery, this.loadingItems);
		this.queryMapObject = new MapResultQueryObject(mapQueryCb, this.loadingItems);
	}

	Grouping.prototype = {
		toggleExpansion: function() {
			if (this.expanded) {
				this.expanded = false;
				return;
			}

			this.expanded = true;

			this.guaranteeItems();
		},
		guaranteeItems: function() {
			if (this.$scope.viewstyle === 'map') {
				if (!this.queryMapObject.hasLoaded()) {
					// load in first page of data
					this.queryMapObject.queryItems();
				}
			} else {
				if (!this.queryPagedObject.hasLoaded()) {
					// load in first page of data
					this.queryPagedObject.queryItems();
				}
			}
		},
	};
	
	return Grouping;
}]);