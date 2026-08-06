using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using NLog;
using RceDoorzoeker.Configuration;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.Core.Predicates;
using Trezorix.RnaRemote.RepositoryBase;

namespace RceDoorzoeker.Services
{
	public class FacetRegistry
	{
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();
		
		private readonly IList<Facet> _facets;

		public FacetRegistry(IItemStore itemStore)
		{
			_facets = LoadFacets(itemStore).ToList();
		}

		private static IEnumerable<Facet> LoadFacets(IItemStore itemStore)
		{
			
			var enabledFacets = DoorzoekerConfig.Current.Facets
				// always add structure even if disabled. Structure is by default grouped on.
				.Where(f => f.Enabled || f.FacetType == FacetType.Structure)
				.ToList();

			var predicateUris = enabledFacets
				.Where(f => f.Enabled && f.PredicateUri != null)
				.Select(f => f.PredicateUri);

			var predicates = itemStore.Load(predicateUris)
				.OfType<Predicate>()
				.Where(p => !p.InRecycleBin)
				.ToList();

			foreach (var facetEntry in enabledFacets)
			{
				var facet = new Facet()
					{
						Type = facetEntry.FacetType,
						Enabled = facetEntry.Enabled // structure might be included but disabled
					};

				switch (facetEntry.FacetType)
				{
					case FacetType.ItemType:
						facet.FieldName = "rnax_resource_itemType";
						break;
					case FacetType.Structure:
						facet.FieldName = "root";
						break;
					case FacetType.Predicate:
						
						var predicate = predicates.SingleOrDefault(p => p.Uri == facetEntry.PredicateUri);
						if (predicate == null)
						{
							s_logger.Warn("The facets configuration contains a predicate based facet with uri: " + facetEntry.PredicateUri + ". No such predicate found.");
							continue;
						}

						var sysLabel = DetermineSysLabel(predicate);
				
						if (sysLabel == null) continue;

						sysLabel = GetSolrFieldName(sysLabel);

						facet.FieldName = string.Format(predicate.TreeIndexing ? "rnax_resource_ancestorOrSelf_{0}" : "rnax_resource_{0}", sysLabel);
						facet.Predicate = predicate;
						break;
					default:
						s_logger.Warn("Facet with unknown type: " + facetEntry.FacetType);
						continue;
				}
				yield return facet;
			}
		}

		private static string GetSolrFieldName(string str)
		{
			// strip anything other then alphanumerics
			return Regex.Replace(str, @"[^A-Za-z0-9]", "", RegexOptions.None);
		}

		private static string DetermineSysLabel(Item item)
		{
			var sys = item.PrefLabel.SingleOrDefault(l => "sys".Equals(l.Language, StringComparison.OrdinalIgnoreCase));
			if (sys != null)
			{
				return sys.Value;
			}
			var first = item.PrefLabel.First();
			
			return first == null ? null : first.Value;
		}

		public IList<Facet> Facets
		{
			get { return _facets; }
		} 
	}

	public enum FacetType
	{
		Predicate = 0,
		ItemType,
		Structure
	}
}