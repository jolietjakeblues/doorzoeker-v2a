using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using AutoMapper;
using Microsoft.Ajax.Utilities;
using NLog;
using RceDoorzoeker.Models.Search;
using RceDoorzoeker.Services;
using RceDoorzoeker.Services.Mappers;
using RceDoorzoeker.Services.Querying;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.RepositoryBase;

namespace RceDoorzoeker.Controllers
{
	public class SearchController : ApiController
	{
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();

		private readonly FacetQueryer _facetQueryer;
		private readonly GroupedItemsQueryer _groupedItemsQueryer;

		private readonly FacetRegistry _facetRegistry;

		private readonly FacetMapper _facetMapper;
		private readonly GroupingsResultMapper _groupingsResultMapper;
		private readonly ItemSuggestQueryer _itemSuggestQueryer;

		private readonly IBulkLoad _bulkLoader;

		public SearchController(
			FacetQueryer facetQueryer, 
			GroupedItemsQueryer groupedItemsQueryer, 
			FacetRegistry facetRegistry, 
			FacetMapper facetMapper, 
			GroupingsResultMapper groupingsResultMapper, 
			ItemSuggestQueryer itemSuggestQueryer, 
			IBulkLoad bulkLoader)
		{
			_facetQueryer = facetQueryer;
			_groupedItemsQueryer = groupedItemsQueryer;

			_facetRegistry = facetRegistry;
			_facetMapper = facetMapper;
			_groupingsResultMapper = groupingsResultMapper;
			_itemSuggestQueryer = itemSuggestQueryer;
			_bulkLoader = bulkLoader;
		}

		[HttpGet]
		public GroupingItemsModel Grouping([FromUri] SearchGroupingItemsSpec searchSpec)
		{
			var query = searchSpec.Query;
			var facetOn = searchSpec.FacetOn;

			s_logger.Info("Received search: " + Request.RequestUri.Query);

			string groupByFieldName = DetermineGroupingSolrField(searchSpec.GroupBy);

			if (string.IsNullOrWhiteSpace(query))
			{
				query = "*";
			}

			var solrQuery = SetupSolrQuery(facetOn, query);

			s_logger.Info("Running solr query: " + solrQuery);

			// ToDo: don't hardcode max # of groups..
			var items = _groupedItemsQueryer.QueryGroupingItems(solrQuery, groupByFieldName, searchSpec.GroupingUri, searchSpec.Start, searchSpec.Count); 

			s_logger.Info("Parsing SOLR result");

			var model = new GroupingItemsModel();
			
			Mapper.Map(items, model);

			s_logger.Info("Got items results: " + items.Items.Count());

			return model;
		}

		[HttpGet]
		public ClusteredMapResultModel GroupingMap([FromUri] ViewportSearchGroupingItemsSpec searchSpec)
		{
			var query = searchSpec.Query;
			var facetOn = searchSpec.FacetOn;

			if (searchSpec.BottomRight == null || searchSpec.TopLeft == null)
			{
				var message = new HttpResponseMessage(HttpStatusCode.BadRequest)
					{
						ReasonPhrase = "Missing view port parameters TopLeft and/or BottomRight"
					};
				throw new HttpResponseException(message);
			}

			// ToDo: Move more/most code into query service!

			s_logger.Info("Received search: " + Request.RequestUri.Query);

			string groupByFieldName = DetermineGroupingSolrField(searchSpec.GroupBy);

			if (string.IsNullOrWhiteSpace(query))
			{
				query = "*";
			}

			var solrQuery = SetupSolrQuery(facetOn, query);

			solrQuery += string.Format(" AND (rnax_float_hasLatitude:[{0} TO {1}] AND rnax_float_hasLongitude:[{2} TO {3}])", searchSpec.TopLeft.Latitude.ToStringInvariant(), searchSpec.BottomRight.Latitude.ToStringInvariant(), searchSpec.BottomRight.Longitude.ToStringInvariant(), searchSpec.TopLeft.Longitude.ToStringInvariant());

			const int map_view_pixel_height = 500;

			double latLongPerPixel = LatLongHelper.CalcLatLongPerPixel(map_view_pixel_height, searchSpec.TopLeft, searchSpec.BottomRight);

			var sw = new Stopwatch();
			
			s_logger.Info("Running SOLR query: " + solrQuery);
			sw.Start();
			
			var result = _groupedItemsQueryer.QueryGroupingItemsMap(solrQuery, groupByFieldName, searchSpec.GroupingUri, latLongPerPixel);

			sw.Stop();

			double timingPerItem = 0;
			double itemsPerSec = 0;
			if (result.TotalCount > 0)
			{
				timingPerItem = (Double) sw.ElapsedMilliseconds / result.TotalCount;
				itemsPerSec = (Double)result.TotalCount / (sw.ElapsedMilliseconds / 1000.0);
			}
			Debug.WriteLine("Queried clustered map items in {0:0.000} sec. Averaging {1:0.000} msec per item. {2:0.000} items per second.", sw.ElapsedMilliseconds / 1000.0, timingPerItem, itemsPerSec);
			s_logger.Info("Parsing SOLR result");

			timingPerItem = 0;
			itemsPerSec = 0;

			sw.Reset();
			sw.Start();
			var model = new ClusteredMapResultModel();
			Mapper.Map(result, model);
			sw.Stop();
			if (result.TotalCount > 0)
			{
				timingPerItem = (Double)sw.ElapsedMilliseconds / result.TotalCount;
				itemsPerSec = (Double)result.TotalCount / (sw.ElapsedMilliseconds / 1000.0);
			}
			Debug.WriteLine("Mapped result items in {0:0.000} sec. Averaging {1:0.000} msec per item. {2:0.000} items per second.", sw.ElapsedMilliseconds / 1000.0, timingPerItem, itemsPerSec);

			s_logger.Info("Got items results: " + result.TotalCount);

			return model;
		}

		[HttpGet]
		public SearchGroupsModel Groups([FromUri] SearchGroupingsSpec searchSpec)
		{
			var query = searchSpec.Query;
			var facetOn = searchSpec.FacetOn;
			
			s_logger.Info("Received search: " + Request.RequestUri.Query);

			string groupByFieldName = DetermineGroupingSolrField(searchSpec.GroupBy);

			if (string.IsNullOrWhiteSpace(query))
			{
				query = "*";
			}

			var solrQuery = SetupSolrQuery(facetOn, query);

			s_logger.Info("Running solr query: " + solrQuery);

			var groupsResult = _groupedItemsQueryer.QueryGroupings(solrQuery, groupByFieldName);

			s_logger.Info("Parsing SOLR result");

			var groupsModel = _groupingsResultMapper.MapGroupsResult(groupsResult).ToList();
			
			s_logger.Info("Got grouped results: " + groupsModel.Count());
			
			var model = new SearchGroupsModel()
			{
				Query = query,
				Groups = groupsModel,
			};

			return model;
		}
		
		[HttpGet]
		public SearchFacetsModel Facets([FromUri] SearchFacetsSpec searchSpec)
		{
			var query = searchSpec.Query;
			var facetOn = searchSpec.FacetOn;
			var facetExpansion = searchSpec.FacetExpansion;
			
			var facetCount = searchSpec.FacetCount;

			var sw = new Stopwatch();
			sw.Start();

			s_logger.Info("Received search: " + Request.RequestUri.Query);

			if (string.IsNullOrWhiteSpace(query))
			{
				query = "*";
			}

			var solrQuery = SetupSolrQuery(facetOn, query);

			s_logger.Info(string.Format("Query constructed {1}ms. Running solr query: {0}", solrQuery, sw.ElapsedMilliseconds));
			sw.Restart();

			var activeFacetsRetrieval = Task.Factory
				.StartNew(() =>
					PrepareActiveFacetModels(facetOn)
			);

			IEnumerable<FacetResult> result;
			// ToDo: How can we do proper null detection on these incoming models?
			if (facetExpansion != null && !string.IsNullOrWhiteSpace(facetExpansion.Type))
			{
				var facet = DetermineExpandedFacet(facetExpansion);

				result = _facetQueryer.QueryFacets(solrQuery, DetermineGroupingSolrField(searchSpec.GroupBy), facetCount, facet.FieldName, facetExpansion.Start, facetExpansion.Count);
			}
			else
			{
				result = _facetQueryer.QueryFacets(solrQuery, DetermineGroupingSolrField(searchSpec.GroupBy), facetCount);
			}

			s_logger.Info(string.Format("Query result received {0}ms. Parsing SOLR result.", sw.ElapsedMilliseconds));
			sw.Restart();

			var facetModels = _facetMapper.MapFacets(result);
			
			s_logger.Info(string.Format("Got facet results in {1}ms. Number of results: {0}", facetModels.Count, sw.ElapsedMilliseconds));
			sw.Stop();


			var model = new SearchFacetsModel()
			{
				ActiveFacets = activeFacetsRetrieval.Result,
				Query = query,
				Facets = facetModels,
				
			};

			if (facetExpansion != null)
			{
				model.ExpandedFacetStart = facetExpansion.Start;
			}
			
			return model;
		}

		private List<ActiveFacetModel> PrepareActiveFacetModels(List<FacetFilterModel> facetOn)
		{
			if (facetOn == null) return null;

			var predicateUris = facetOn
				.Where(IsPredicateBasedFacet)
				.Select(f => f.PredicateUri)
				.Distinct();

			var itemUris = facetOn
				.Select(f => f.Uri);

			var facetItemUris = itemUris.Union(predicateUris);

			var facetItems = _bulkLoader.Load(facetItemUris).ToList();

			var activeFacetsModel = new List<ActiveFacetModel>(facetOn.Count());

			foreach (var facet in facetOn)
			{
				var facetItem = facetItems.SingleOrDefault(i => i.Uri == facet.Uri);
				if (facetItem == null)
				{
					continue;
				}

				var activeFacet = new ActiveFacetModel()
					{
						Classification = DoorzoekerModelMapper.DetermineClassification(facetItem),
						Facet = new FacetModel()
							{
								Type = facet.Type,
								PredicateUri = facet.PredicateUri,
								Label = DetermineActiveFacetLabel(facet, facetItems)
							},
						Label = DoorzoekerModelMapper.DeterminePreferredLabel(facetItem.PrefLabel).Value,
						Uri = facet.Uri
					};

				activeFacetsModel.Add(activeFacet);
			}

			return activeFacetsModel;
		}

		private static bool IsPredicateBasedFacet(FacetFilterModel f)
		{
			var typeNormalized = f.Type.ToLowerInvariant();
			return typeNormalized != "structure" && typeNormalized != "itemtype";
		}

		private string DetermineActiveFacetLabel(FacetFilterModel facet, IEnumerable<Item> itemLookup)
		{
			if (facet.Type.ToLowerInvariant() == "itemtype")
			{
				return "Item type";
			}

			if (facet.Type.ToLowerInvariant() == "structure")
			{
				return "Structuur";
			}

			var predicate = itemLookup.SingleOrDefault(i => i.Uri == facet.PredicateUri);

			if (predicate != null)
			{
				return DoorzoekerModelMapper.DeterminePreferredLabel(predicate.PrefLabel).Value;
			}

			return null;
		}

		private Facet DetermineExpandedFacet(FacetExpansionModel facetExpansion)
		{
			var facetValue = facetExpansion.Type.ToLowerInvariant();
			FacetType facetType = ParseFacetType(facetValue);
			Facet facet;
			if (facetType == FacetType.Predicate)
			{
				facet =
					_facetRegistry.Facets.SingleOrDefault(
						f => f.Type == FacetType.Predicate
						     && f.Predicate != null
						     && f.Predicate.Uri.Equals(facetExpansion.Uri, StringComparison.OrdinalIgnoreCase));
			}
			else
			{
				facet = _facetRegistry.Facets.SingleOrDefault(f => f.Type == facetType);
			}

			if (facet == null)
			{
				throw new HttpResponseException(new HttpResponseMessage(HttpStatusCode.BadRequest)
					{
						ReasonPhrase = "Can't figure out which facet to page on, facet not found."
					});
			}
			return facet;
		}

		private string SetupSolrQuery(IEnumerable<FacetFilterModel> facets, string query)
		{
			if (facets == null) return query;

			var facetPredicates = facets
				.Where(f => f != null && f.Uri != null)
				.Select(ConstructSolrFacetPredicate).ToList();

			if (facetPredicates.Any())
			{
				return string.Format("({0}) AND {1}", query, string.Join(" AND ", facetPredicates));
			}

			return query;
		}

		private string ConstructSolrFacetPredicate(FacetFilterModel facetOn)
		{
			if (facetOn.Type != null)
			{
				if (facetOn.Type.ToLowerInvariant() == "itemtype")
				{
					return string.Format("rnax_resource_itemType:\"{0}\"", facetOn.Uri);
				}
				if (facetOn.Type.ToLowerInvariant() == "structure")
				{
					return string.Format("root:\"{0}\"", facetOn.Uri);
				}	
			}
			
			var facet = _facetRegistry.Facets.SingleOrDefault(f => f.Predicate != null && f.Predicate.Uri == facetOn.PredicateUri);
			if (facet == null)
			{
				throw new HttpResponseException(new HttpResponseMessage(HttpStatusCode.BadRequest)
					{
						ReasonPhrase = "Can't facet on the given predicate uri, the predicate doesn't exist."
					});
			}

			return string.Format("{0}:\"{1}\"", facet.FieldName, facetOn.Uri);
		}

		private FacetType ParseFacetType(string facetValue)
		{
			switch (facetValue.ToLowerInvariant())
			{
				case "predicate" :
					return FacetType.Predicate;
				case "itemtype":
				case "item type":
					return FacetType.ItemType;
				case "structure":
				case "referencestructure":
				case "reference structure":
					return FacetType.Structure;
			}
			throw new Exception(string.Format("Unknown facet type: '{0}'", facetValue));
		}

		private string DetermineGroupingSolrField(GroupByModel groupBy)
		{
			string groupByVal;
			if (string.IsNullOrWhiteSpace(groupBy.Type))
			{
				groupByVal = "structure";
			}
			else
			{
				groupByVal = groupBy.Type.ToLowerInvariant();
			}

			switch (groupByVal)
			{
				case "referencestructure" :
				case "structure" :
					return "root";
				case "type" :
				case "itemtype" :
					return "rnax_resource_itemType";
				case "predicate" :
					// parse out predicate
					var groupByPredicate = _facetRegistry.Facets
						.Where(f => f.Type == FacetType.Predicate)
						.SingleOrDefault(f => f.Predicate.Uri == groupBy.Uri);

					if (groupByPredicate == null)
					{
						throw new HttpResponseException(new HttpResponseMessage(HttpStatusCode.BadRequest)
						{
							ReasonPhrase = string.Format("Can't group search results on '{0}', no predicate found with that URI.", groupBy)
						});
					}
					return groupByPredicate.FieldName;
				default:
					
					throw new HttpResponseException(new HttpResponseMessage(HttpStatusCode.BadRequest)
						{
							ReasonPhrase = "groupBy should either be 'structure', 'itemtype' or 'predicate' with a facet's predicate URI"
						});
					
			}
		}

		[HttpGet]
		public IEnumerable<TermSuggestModel> TermSuggest(string term, int count)
		{
			var suggestions = _itemSuggestQueryer.SuggestItems(term, count);

			return suggestions.Items.Select(s => new TermSuggestModel() { Value = DoorzoekerModelMapper.DeterminePreferredLabel(s.PrefLabels).Value }).ToList();
		}
	}
}
