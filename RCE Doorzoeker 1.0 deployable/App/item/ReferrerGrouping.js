angular.module('Item')
	.factory('ReferrerGrouping', ['PagedGroupingResultQueryObject',
		function (PagedGroupingResultQueryObject) {

			function ReferrerGrouping(group, pagedGroupingQuery) {

				var groupUri = group.groupLabel.link;

				var loadingItems = false; // ToDo: ?

				this.queryPagedObject = new PagedGroupingResultQueryObject(groupUri, pagedGroupingQuery, loadingItems);
				this.expanded = false;

				this.group = group;
			}

			ReferrerGrouping.prototype = {
				toggleExpansion: function () {
					if (this.expanded) {
						this.expanded = false;
						return;
					}

					this.expanded = true;

					if (!this.queryPagedObject.hasLoaded()) {
						// load in first page of data
						this.queryPagedObject.queryItems();
					}

				},
			};

			return ReferrerGrouping;
		}
	]);
