using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using AutoMapper;
using NLog;
using RceDoorzoeker.Models.Search;
using RceDoorzoeker.Services.Querying;
using Trezorix.RnaRemote.Core.ContentItems;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.RepositoryBase;

namespace RceDoorzoeker.Services.Mappers
{
	public class FacetMapper
	{
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();
		private readonly IBulkLoad _bulkLoader;

		public FacetMapper(IBulkLoad bulkLoader)
		{
			_bulkLoader = bulkLoader;
		}

		public Collection<FacetResultModel> MapFacets(IEnumerable<FacetResult> facets)
		{
			var result = facets.ToList();

			var facetModels = new Collection<FacetResultModel>();
			
			var facetValueUris = result
				.SelectMany(f => f.FacetValues)
				.Select(fv => fv.Uri)
				.Distinct(); // facets can share items (predicates with simular ranges)
			
			var sw = new Stopwatch();
			sw.Start();

			var values = _bulkLoader
				.Load(facetValueUris)
				.Where(i => !IsAnnexItem(i))
				.ToLookup(fv => fv.Uri);

			s_logger.Info("Loaded {0} values through bulkloader in {1}ms...", values.Count, sw.ElapsedMilliseconds);
			sw.Restart();

			foreach (var facet in result)
			{
				var facetModel = Mapper.Map<FacetResultModel>(facet);

				// note: ToList'ing facet values cause we'll delete from the original collection while enumerating
				foreach (var facetValue in facetModel.FacetValues.ToList())
				{
					var facetValueItem = values[facetValue.Uri].SingleOrDefault();
					if (facetValueItem != null)
					{
						facetValue.Label = DoorzoekerModelMapper.DeterminePreferredLabel(facetValueItem.PrefLabel).Value;
						facetValue.Classification = DoorzoekerModelMapper.DetermineClassification(facetValueItem);
					}
					else
					{
						// item doesn't exist, remove from facet list
						facetModel.FacetValues.Remove(facetValue);
					}
				}

				if (facetModel.FacetValues.Count != 0)
				{
					// might have removed all
					facetModels.Add(facetModel);
				}
			}
			s_logger.Info("Mapped {0} facets in {1}ms.", facetModels.Count, sw.ElapsedMilliseconds);
			sw.Stop();

			return facetModels;
		}

		private bool IsAnnexItem(Item item)
		{
			var annex = item as ContentItem;
			if (annex != null)
			{
				return annex.IsAnnexItem;
			}
			return false;
		}
	}
}