angular.module("Thesaurus")
	.service("NodeHandler", ['$http', 'PagingSet',
	function($http, PagingSet) {

		var nr_of_displayed_pages = 5;
		var items_per_page = 25;

		function mapData(data) {

			data.items.forEach(function(child) {
				child.loadingChildren = false;
				child.currentPage = 1;
				child.expanded = false;
				child.children = null;
				child.pages = null;
				child.selected = false;
			});
		}

		function findChild(children, uri) {
			for (var i = 0; i < children.length; i++) {
				if (children[i].value.link === uri) {
					return children[i];
				}
			}
			return null;
		}

		function configureNodePagingSet(node, start, totalResults) {
			node.pagingSet = new PagingSet(nr_of_displayed_pages);

			node.currentPage = Math.floor(start / items_per_page) + 1;
			node.numberOfPages = Math.ceil(totalResults / items_per_page);

			var pages = node.pagingSet.assemblePagingSet(node.currentPage, node.numberOfPages);
			if (pages.length > 3) {
				node.pages = pages;
			} else {
				node.pages = null;
			}
		}

		this.expand = function expand(node, itemPath) {
			console.log('expanding node ' + node.value.link);
			if (!node.hasChildren) {
				// ignore
				return;
			}

			if (!node.expanded) {
				// when the root is selected further nodes will be missing
				if (itemPath && itemPath.nodes.length) {
					var childRow = itemPath.nodes[0].row - 1;
					var onPageNumber = Math.floor(childRow / items_per_page) + 1;
					node.currentPage = onPageNumber;

					this.loadChildren(node, itemPath);

				} else {
					this.loadChildren(node);
					node.selected = true;
				}
			}
		};

		this.loadChildren = function(node, itemPath) {

			node.loadingChildren = true;
			var start = (node.currentPage - 1) * items_per_page;

			var that = this;

			$http.get('/item/children', {
					params: {
						uri: node.value.link,
						start: start,
						count: items_per_page
					}
				})
				.success(function(data) {
					console.log('setting loaded children for node ' + node.value.link);

					mapData(data);
					node.children = data.items;

					configureNodePagingSet(node, data.start, data.totalResults);
					node.loadingChildren = false;
					node.expanded = true;

					// itemPath is passed in when we are part of path
					if (itemPath) {
						// find the relevant child
						var children = node.children;

						var childPathNode = itemPath.nodes.shift();
						var childNode = findChild(children, childPathNode.uri);

						if (itemPath.nodes.length > 0) {
							that.expand(childNode, itemPath);
						} else {
							// leaf
							if (childNode) {
								childNode.selected = true;
								// when showing leaf with further children, expand node
								if (childNode.hasChildren) {
									that.expand(childNode);
								}
							}
						}
					}
				});
		};

		this.fold = function(node) {
			console.log('folding on node ' + node.value.link + ' from ' + node.expanded);
			if (!node.hasChildren) {
				// ignore
				return;
			}

			if (node.expanded) {
				// clean the children
				node.expanded = false;
				node.children = null;
			} else {
				this.loadChildren(node);
			}
		};

		this.gotoPage = function(node, link) {
			if (!link) {
				return false;
			}
			console.log('paging to page ' + link);
			node.currentPage = link;

			this.loadChildren(node);
			return false;
		};
	}
]);