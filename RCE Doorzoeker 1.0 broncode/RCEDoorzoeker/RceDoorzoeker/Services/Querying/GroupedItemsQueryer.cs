using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Web;
using RceDoorzoeker.Services.MapItemClustering;
using RceDoorzoeker.Services.RnaApiClient;
using RceDoorzoeker.Services.RnaApiClient.DTO;

namespace RceDoorzoeker.Services.Querying
{
	public class GroupedItemsQueryer
	{
		private readonly LocalWebApiV1Client _client;
		private readonly ItemsResultParser _itemsResultParser;
		private readonly FacetsResultParser _facetsResultParser;

		public GroupedItemsQueryer(LocalWebApiV1Client client, ItemsResultParser itemsResultParser, FacetsResultParser facetsResultParser)
		{
			_client = client;
			_itemsResultParser = itemsResultParser;
			_facetsResultParser = facetsResultParser;
		}

		public ClusteredItems QueryGroupingItemsMap(string query, string groupFieldName, string groupingUri, double latLongPerPixel)
		{
			// SOLR can not return a 'numFound' for facet values, you can request chunks but not see how many items there are.
			// We always ask one more item then requested to see if we have "more" or not. After parsing the SOLR result we need remove this extra entry again

			var fqFilter = ItemFilter.FqFilter;
			
			var fq = string.Format("NOT item_container_type:root AND is_in_recycle_bin:false AND {0}:\"{1}\" AND ({2})",
				groupFieldName, groupingUri, fqFilter);

			var pars = new NameValueCollection()
				{
					{"q", HttpUtility.UrlEncode(query)},
					{"start", 0.ToString()},
					{"rows", 2500.ToString()},
					{"fq", fq},
					{"fl", "id rnax_resource_itemType skos_prefLabel_lang_* rnax_float_hasLatitude rnax_float_hasLongitude"}, 
				};

			string queryString = pars.ToFormsQueryString();

			using (var stream = _client.ApiCall("/api/directsolrsearch.aspx", queryString))
			{
				return MapSearchResultParser.ConsumeMapResult(stream, latLongPerPixel);
			}
			
		}
		
		public PagedList<SearchResultItem> QueryGroupingItems(string query, string groupFieldName, string groupingUri, int start = 0, int count = 15)
		{
			// SOLR can not return a 'numFound' for facet values, you can request chunks but not see how many items there are.
			// We always ask one more item then requested to see if we have "more" or not. After parsing the SOLR result we need remove this extra entry again

			var fqFilter = ItemFilter.FqFilter;

			var fq = string.Format("NOT item_container_type:root AND is_in_recycle_bin:false AND {0}:\"{1}\" AND ({2})",
				groupFieldName, groupingUri, fqFilter);

			var pars = new NameValueCollection()
				{
					{"q", HttpUtility.UrlEncode(query)},
					{"start", start.ToString()},
					{"rows", count.ToString()},
					{"fq", fq},
					{"fl", "id item_name root rnax_resource_itemType skos_prefLabel_lang_*"}, 
					
					// ToDo: Facet.missing, facet.method
				};

			string queryString = pars.ToFormsQueryString();

			var result = _client.GetDirectSolrSearchResult(queryString);

			var items = _itemsResultParser.Parse(result);

			if (items == null) return null;

			items.PageSpec = new PageSpec()
				{
					Start = start,
					Count = count,
				};

			return items;
		}

		public FacetResult QueryGroupings(string query, string groupFieldName)
		{
			var fqFilter = ItemFilter.FqFilter;
			
			// SOLR can not return a 'numFound' for facet values, you can request chunks but not see how many items there are.
			// We always ask one more item then requested to see if we have "more" or not. After parsing the SOLR result we need remove this extra entry again
			const int facet_count = 100;

			var fq = string.Format("(is_in_recycle_bin:false AND {0}:['' TO *]) NOT item_container_type:root AND ({1})", groupFieldName, fqFilter);

			var pars = new NameValueCollection()
				{
					{"q", HttpUtility.UrlEncode(query)},
					{"start", "0"},
					{"rows", "0"},
					{"fq", fq},
					{"fl", "id item_name root rnax_resource_itemType skos_prefLabel_lang_*"}, 
					{"facet", "true"},
					{"facet.limit", (facet_count + 1).ToString() },
					{"facet.mincount", "1"},
					{"facet.offset", "0"},
					{"facet.sort", "count"},
					// request the groupby value as facet
					{"facet.field", groupFieldName},
					
					// ToDo: Facet.missing, facet.method
				};

			string queryString = pars.ToFormsQueryString();

			var result = _client.GetDirectSolrSearchResult(queryString);

			var facet = _facetsResultParser.Parse(result).SingleOrDefault();

			if (facet == null) return new FacetResult() { FacetValues = new List<FacetValue>() };

			// remove the extra result that was used for 'more values' detection
			if (facet.FacetValues.Count > facet_count)
			{
				facet.HasMoreValues = true;
				facet.FacetValues.Remove(facet.FacetValues.Last());
			}

			return facet;
		}
		
	}
}