using System.Collections.Specialized;
using System.Web;
using RceDoorzoeker.Services.RnaApiClient;
using RceDoorzoeker.Services.RnaApiClient.DTO;

namespace RceDoorzoeker.Services.Querying
{
	public class ItemSuggestQueryer
	{
		private readonly LocalWebApiV1Client _client;
		private readonly ItemsResultParser _itemsResultParser;
		
		public ItemSuggestQueryer(LocalWebApiV1Client client, ItemsResultParser itemsResultParser)
		{
			_client = client;
			_itemsResultParser = itemsResultParser;
		}

		public PagedList<ItemSuggestResult> SuggestItems(string query, int count = 15)
		{
			var q = string.Format("skos_prefLabel:{0}*^4 OR skos_prefLabel:*{0}*^3 OR skos_altLabel:{0}*^2 OR skos_altLabel:*{0}*", query);

			var pars = new NameValueCollection()
				{
					{"q", HttpUtility.UrlEncode(q)},
					{"start", "0"},
					{"rows", count.ToString()},
					{"fq", "NOT item_container_type:root AND is_in_recycle_bin:false"},
					{"fl", "id item_name root rnax_resource_itemType skos_prefLabel_lang_* skos_altLabel_lang_*"}, 
				};

			string queryString = pars.ToFormsQueryString();

			var result = _client.GetDirectSolrSearchResult(queryString);

			var items = _itemsResultParser.ParseItemSuggestions(result);

			if (items == null) return null;

			items.PageSpec = new PageSpec()
				{
					Start = 0,
					Count = count,
				};

			return items;
		}

	}
}