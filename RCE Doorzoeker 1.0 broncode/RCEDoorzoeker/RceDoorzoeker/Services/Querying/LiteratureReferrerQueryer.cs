using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.Querying
{
	public class LiteratureReferrerQueryer
	{
		// SOLR field for writings: content_xml_text

		private readonly GroupedItemsQueryer _groupedItemsQueryer;

		public LiteratureReferrerQueryer(GroupedItemsQueryer groupedItemsQueryer)
		{
			_groupedItemsQueryer = groupedItemsQueryer;
		}

		public FacetResult QueryGroupings(Item item)
		{
			var query = ConstructSolrQuery(item);

			var data = _groupedItemsQueryer.QueryGroupings(query, groupFieldName: "root");

			return data;
		}

		private string ConstructSolrQuery(Item item)
		{
			// fetch the item and construct query for all it's labels
			
			var prefLabels = item.PrefLabel.Select(l => l.Value);
			var altLabels = item.AltLabel.Select(l => l.Value);
			var hiddenLabels = item.HiddenLabel.Select(l => l.Value);

			var labels = new List<string>();
			labels.AddRange(prefLabels);
			labels.AddRange(altLabels);
			labels.AddRange(hiddenLabels);

			var query = string.Join(" OR ", labels.Select(l => string.Format("content_xml_text:\"{0}\"", l)));
			return query;
		}

		public PagedList<SearchResultItem> QueryGroupingItems(Item item, string groupingUri, int start = 0, int count = 15)
		{
			var query = ConstructSolrQuery(item);
			return _groupedItemsQueryer.QueryGroupingItems(query, "root", groupingUri, start, count);
		}
	}
}