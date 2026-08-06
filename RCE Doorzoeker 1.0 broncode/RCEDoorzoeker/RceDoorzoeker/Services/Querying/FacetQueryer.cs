using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Web;
using RceDoorzoeker.Services.RnaApiClient;

namespace RceDoorzoeker.Services.Querying
{
	public class FacetQueryer
	{
		private readonly LocalWebApiV1Client _client;
		
		private readonly FacetsResultParser _facetsResultParser;
		private readonly FacetRegistry _facetRegistry;

		public FacetQueryer(
			LocalWebApiV1Client client, 
			FacetsResultParser facetsResultParser, 
			FacetRegistry facetRegistry)
		{
			_client = client;
			_facetsResultParser = facetsResultParser;
			_facetRegistry = facetRegistry;
		}
 
		public IEnumerable<FacetResult> QueryFacets(string query, string groupFieldName, int facetCount, string expandedFacetFieldName = null, int expandStart = 0, int expandCount = 30)
		{
			// SOLR can not return a 'numFound' for facet values, you can request chunks but not see how many items there are.
			// We always ask one more item then requested to see if we have "more" or not. After parsing the SOLR result we need remove this extra entry again

			var filter = ItemFilter.FqFilter;
			
			var fq = string.Format("(is_in_recycle_bin:false AND {0}:['' TO *]) NOT item_container_type:root AND ({1})", groupFieldName, filter);

			var pars = new NameValueCollection()
				{
					{"q", HttpUtility.UrlEncode(query)},
					{"start", "0"},
					{"rows", "0"},
					{"fq", fq},
					{"fl", "id item_name root rnax_resource_itemType skos_prefLabel_lang_*"}, // note: still need itemtype ?
					{"facet", "true"},
					{"facet.limit", (facetCount + 1).ToString() },
					{"facet.mincount", "1"},
					{"facet.offset", "0"},
					{"facet.sort", "count"}

					// ToDo: Facet.missing, facet.method

				};

			if (expandedFacetFieldName != null)
			{
				// we add one extra to the limit so we can see if there are more facet values after this page
				ConfigureFacetExpansion(pars, expandedFacetFieldName, expandStart, expandCount + 1);	
			}
			
			SetSolrFacetFields(pars);

			string queryString = pars.ToFormsQueryString();

			var result = _client.GetDirectSolrSearchResult(queryString);

			var facetData = _facetsResultParser.Parse(result);

			foreach (var facet in facetData)
			{
				var appliedFacetCount = facetCount;
				// if this facet is the expanded facet, the value count will be larger then standard
				if (facet.Facet.FieldName == expandedFacetFieldName)
				{
					appliedFacetCount = expandCount;
				}
				// remove the extra result that was used for 'more values' detection
				if (facet.FacetValues.Count > appliedFacetCount)
				{
					facet.HasMoreValues = true;
					facet.FacetValues.Remove(facet.FacetValues.Last());
				}
			}

			return facetData;
		}

		private void ConfigureFacetExpansion(NameValueCollection pars, string fieldName, int start, int expandToCount)
		{
			var facetSpecifier = string.Format("f.{0}.facet.", fieldName);

			pars.Add(facetSpecifier + "offset", start.ToString());
			pars.Add(facetSpecifier + "limit", expandToCount.ToString());
		}

		private void SetSolrFacetFields(NameValueCollection pars)
		{
			foreach (var facet in _facetRegistry.Facets.Where(f => f.Enabled))
			{
				pars.Add("facet.field", facet.FieldName);
			}
			
		}
	}

}