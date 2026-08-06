using System.Collections.Specialized;
using System.Web;
using Microsoft.Ajax.Utilities;
using RceDoorzoeker.Services.MapItemClustering;
using RceDoorzoeker.Services.RnaApiClient;
using RceDoorzoeker.Services.RnaApiClient.DTO;

namespace RceDoorzoeker.Services.Querying
{
	public class ReferrerQueryer
	{
		private readonly GroupedItemsQueryer _groupedItemsQueryer;
		private readonly LocalWebApiV1Client _client;

		public ReferrerQueryer(GroupedItemsQueryer groupedItemsQueryer, LocalWebApiV1Client client)
		{
			_groupedItemsQueryer = groupedItemsQueryer;
			_client = client;
		}

		public ClusteredItems QueryMap(string uri, LatLong topLeft, LatLong bottomRight, double latLongPerPixel)
		{
			var query = string.Format(@"resource:""{0}""", uri);

			query += string.Format(" AND (rnax_float_hasLatitude:[{0} TO {1}] AND rnax_float_hasLongitude:[{2} TO {3}])", topLeft.Latitude.ToStringInvariant(), bottomRight.Latitude.ToStringInvariant(), bottomRight.Longitude.ToStringInvariant(), topLeft.Longitude.ToStringInvariant());

			var fqFilter = ItemFilter.FqFilter;
			
			var fq = string.Format("NOT item_container_type:root AND is_in_recycle_bin:false AND ({0})", fqFilter);

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

		public FacetResult QueryGroupings(string uri)
		{
			// http://default/api/directsolrsearch.aspx?rna_api_key=c85964e5-f7a9-40ed-96fc-0cfc17c59926&q=resource:"http://www.rnaproject.org/data/6b5fbc6e-cc58-45e6-889b-cb194642b0ff"&start=0&rows=10&fq=is_in_recycle_bin:false&fl=id item_name root rnax_resource_itemType skos_prefLabel_lang_*&group=true&group.field=root&group.limit=5&group.offset=0

			// start and row are about the groups.
			// group.limit and group.offset are about the docs within each group

			var query = string.Format(@"resource:""{0}""", uri);

			var data = _groupedItemsQueryer.QueryGroupings(query, groupFieldName: "root");

			return data;
		}

		public PagedList<SearchResultItem> QueryGroupingItems(string uri, string groupingUri, int start = 0, int count = 15)
		{
			var query = string.Format(@"resource:""{0}""", uri);
			return _groupedItemsQueryer.QueryGroupingItems(query, "root", groupingUri, start, count);
		}
	}
}