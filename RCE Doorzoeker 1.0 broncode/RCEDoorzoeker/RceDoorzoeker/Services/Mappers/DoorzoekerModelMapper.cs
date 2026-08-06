using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using AutoMapper;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Models.GroupedResults;
using RceDoorzoeker.Models.Item;
using RceDoorzoeker.Models.Search;
using RceDoorzoeker.Services.MapItemClustering;
using RceDoorzoeker.Services.Querying;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote.Core.ContentItems;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.Core.ItemTypes;
using Trezorix.RnaRemote.Core.Predicates;
using Trezorix.RnaRemote.Core.ReferenceStructures;
using Trezorix.RnaRemote.Core.Shared;
using Trezorix.RnaRemote.Core.SimpleNodes;

namespace RceDoorzoeker.Services.Mappers
{
	public class DoorzoekerModelMapper
	{
		private static readonly string s_bronrecord_itemtype_uri;
		private static readonly string s_thesaurusterm_itemtype_uri;

		static DoorzoekerModelMapper()
		{
			var icConfig = DoorzoekerConfig.Current.ItemClassifications;
			
			s_bronrecord_itemtype_uri = icConfig.BronRecordItemTypeUri;
			s_thesaurusterm_itemtype_uri = icConfig.ThesaurusTermItemTypeUri;
		}

		public static void ConfigureMapper()
		{
			Mapper.CreateMap<Item, ItemModel>()
				// ToDo: Localize (how did I do this in diff viewer?)
				.ForMember(d => d.PrefLabels, o => o.ResolveUsing(s => MapLabelList("preferred label", s.PrefLabel))) 
				.ForMember(d => d.AltLabels, o => o.ResolveUsing(s => MapLabelList("alternative label", s.AltLabel)))
				.ForMember(d => d.HiddenLabels, o => o.ResolveUsing(s => MapLabelList("hidden label", s.HiddenLabel)))
				.ForMember(d => d.Definitions, o => o.ResolveUsing(s => MapLabelList("definition", s.Definition)))
				.ForMember(d => d.ItemPrefLabel, o => o.ResolveUsing(s => DeterminePreferredLabel(s.PrefLabel).Value))
				.ForMember(d => d.IsInRecycleBin, o => o.MapFrom(s => s.InRecycleBin))
				.ForMember(d => d.Classification, o => o.MapFrom(s => DetermineClassification(s)))
				.ForMember(d => d.ReferenceStructure, o => o.ResolveUsing(s => MapResource(s.ReferenceStructureResource, null)))
				.ForMember(d => d.Note, o => o.ResolveUsing(s => MapReferenceProperties("notitie", s.Note)))
				.ForMember(d => d.Source, o => o.ResolveUsing(s => MapReferenceProperties("bron", s.Source)))
				.ForMember(d => d.SourceId, o => o.ResolveUsing(s => MapReferenceProperties("bron id", s.SourceId)))
				.ForMember(d => d.Specification, o => o.ResolveUsing(s => MapReferenceProperties("specificatie", s.Specification)))
				.Include<ContentItem, ContentItemModel>()
				.Include<Predicate, PredicateModel>()
				.Include<ItemType, ItemTypeModel>()
				.Include<ReferenceStructure, ReferenceStructureModel>()
				.Include<SimpleNode, SimpleNodeModel>();

			Mapper.CreateMap<ContentItem, ContentItemModel>()
				  .ForMember(s => s.Statements, o => o.ResolveUsing(s => MapStatements(s.Statements)))
				  .ForMember(s => s.ItemTypeResource, o => o.ResolveUsing(s => MapResource(s.ItemTypeResource, null)))
				  .ForMember(s => s.Writing, o => o.ResolveUsing(WritingsFixup.FixupWriting));

			Mapper.CreateMap<ReferenceStructure, ReferenceStructureModel>();

			Mapper.CreateMap<Predicate, PredicateModel>()
				  .ForMember(d => d.InverseResource, o => o.ResolveUsing(s => MapResource(s.InversePredicateResource, null)))
					// ToDo: Joppe: Localize these labels
				  .ForMember(d => d.Range, o => o.ResolveUsing(s => MapItemTypeCollection(s.Range, "range"))) 
				  .ForMember(d => d.Domain, o => o.ResolveUsing(s => MapItemTypeCollection(s.Domain, "domain")));

			Mapper.CreateMap<ItemType, ItemTypeModel>();

			Mapper.CreateMap<SimpleNode, SimpleNodeModel>();

			Mapper.CreateMap<SearchResultItem, ResourceValueModel>()
				.ForMember(d => d.Classification, o => o.ResolveUsing<SearchResultItemClassificationResolver>()
					.ConstructedBy(() => (SearchResultItemClassificationResolver) GlobalConfiguration.Configuration.DependencyResolver.GetService(typeof(SearchResultItemClassificationResolver))))
				.ForMember(d => d.Link, o => o.MapFrom(s => s.Uri))
				.ForMember(d => d.Label, o => o.ResolveUsing(DetermineReferrerLabel))
				.ForMember(d => d.IsInRecycleBin, o => o.Ignore())
				.ForMember(d => d.IsUnresolved, o => o.Ignore());

			Mapper.CreateMap<ChildItem, ChildItemModel>()
				.ForMember(d => d.Value, o => o.ResolveUsing(s => new ResourceValueModel(DeterminePreferredLabel(s.PrefLabel).Value, s.Uri)));

			Mapper.CreateMap<ResultItemGroup, GroupingResultModel>()
				.ForMember(d => d.GroupLabel, o => o.Ignore())
				//.ForMember(d => d.ShowMoreLink, o => o.Ignore());
				.Include<ResultItemGroup, ReferrerGroupResultModel>();
				
			Mapper.CreateMap<PagedList<ChildItem>, ChildrenResultModel>()
				.ForMember(d => d.Start, o => o.MapFrom(s => s.PageSpec.Start))
				.ForMember(d => d.Count, o => o.MapFrom(s => s.PageSpec.Count))
				.ForMember(d => d.TotalResults, o => o.MapFrom(s => s.TotalCount));

			Mapper.CreateMap<PagedList<SearchResultItem>, GroupingItemsModel>()
				.ForMember(d => d.Start, o => o.MapFrom(s => s.PageSpec.Start))
				.ForMember(d => d.TotalCount, o => o.MapFrom(s => s.TotalCount));

			Mapper.CreateMap<ClusteredItems, ClusteredMapResultModel>()
				.ForMember(d => d.Items, o => o.MapFrom(s => s.Points));

			Mapper.CreateMap<Cluster, ClusterModel>()
				.ForMember(d => d.Radius, o => o.ResolveUsing(c => c.PointSizeLatLong() / 2));

			Mapper.CreateMap<FacetResult, FacetResultModel>();

			Mapper.CreateMap<Facet, FacetModel>()
				.ForMember(d => d.Label, o => o.MapFrom(s => DetermineFacetLabel(s)))
				.ForMember(d => d.Type, o => o.MapFrom(s => TranslateTypeEnum(s.Type)));

			Mapper.CreateMap<FacetValue, FacetValueModel>()
				.ForMember(d => d.Label, o => o.Ignore())
				.ForMember(d => d.Classification, o => o.Ignore()); // ToDo: Yes? Can we ignore this value? Seems it's done manually after using mapper

			Mapper.CreateMap<ContentItem, InfoWindowModel>()
				.ForMember(d => d.ItemPrefLabel, o => o.ResolveUsing(s => DeterminePreferredLabel(s.PrefLabel).Value))
				.ForMember(d => d.Classification, o => o.MapFrom(s => DetermineClassification(s)))
				.ForMember(d => d.ReferenceStructure, o => o.ResolveUsing(s => MapResource(s.ReferenceStructureResource, null)))
				.ForMember(s => s.Statements, o => o.ResolveUsing(s => MapInfoWindowStatements(s.Statements)));
				//.ForMember(s => s.ItemTypeResource, o => o.ResolveUsing(s => MapResource(s.ItemTypeResource, null)));

		}

		private static object MapInfoWindowStatements(Statements statements)
		{
			var activePredicates = DoorzoekerConfig.Current
				.MapInfoWindowPredicates
				.Where(p => p.Enabled)
				.Select(p => p.Uri);

			var filteredStatements = FilterInfoWindowStatements(activePredicates, statements);

			return MapStatements(filteredStatements);
		}

		private static IEnumerable<Statement> FilterInfoWindowStatements(IEnumerable<string> activePredicates, IEnumerable<Statement> statements)
		{
			// note: we maintain the configured predicate order also that's why we start from the activePredicates
			return activePredicates
				.SelectMany(p => statements
					.Where(s => string.Equals(s.PredicateResource.Uri, p, StringComparison.OrdinalIgnoreCase)));
		}

		private static string TranslateTypeEnum(FacetType type)
		{
			return Enum.GetName(typeof (FacetType), type).ToLowerInvariant();
		}

		private static string DetermineFacetLabel(Facet facet)
		{
			if (facet.Type == FacetType.ItemType) return "item type";
			if (facet.Type == FacetType.Structure) return "structuur";
			return DeterminePreferredLabel(facet.Predicate.PrefLabel).Value;
		}

		private static string DetermineReferrerLabel(SearchResultItem searchResultItem)
		{
			var label = DeterminePreferredLabel(searchResultItem.Labels);
			// WA: for some reason some solr results don't contain skos_prefLabel_lang_* entries, grab the name of those referrers.
			if (label != null) return label.Value;

			return searchResultItem.Name;
		}

		private static ResourceValueModel MapResource<T>(Resource<T> resource, string literal) where T : Item
		{
			string label;

			bool unresolved = false;
			bool inRecycleBin = false;

			var classification = ItemClassification.None;

			if (resource.Value != null)
			{
				label = DeterminePreferredLabel(resource.Value.PrefLabel).Value;
				inRecycleBin = resource.Value.InRecycleBin;
				
				classification = DetermineClassification(resource.Value);
			}
			else
			{
				unresolved = true;
				label = literal;
			}

			var resourceModel = new ResourceValueModel()
			{
				Link = resource.Uri,
				Label = label,
				IsInRecycleBin = inRecycleBin,
				IsUnresolved = unresolved,
				Classification = classification,
			};

			return resourceModel;
		}

		private static SkosPropertyListModel MapLabelList(string listCaption, IEnumerable<SkosProperty> labels)
		{
			return new SkosPropertyListModel()
			{
				Caption = new ResourceValueModel(listCaption),
				Labels = labels
			};
		}

		private static StringListModel MapReferenceProperties(string listCaption, IEnumerable<string> properties)
		{
			return new StringListModel()
			{
				Caption = new ResourceValueModel(listCaption),
				StringValues = properties
			};
		}

		private static ItemTypeCollectionModel MapItemTypeCollection(IEnumerable<ItemType> itemTypeCollection, string label)
		{
			var itemTypeCollectionModels = itemTypeCollection
				.Where(it => it != null) // ToDo: For some reason there are nulls in the domain list?
				.Select(it => new ResourceValueModel()
				{
					Link = it.Uri,
					Label = DeterminePreferredLabel(it.PrefLabel).Value,
					IsInRecycleBin = it.InRecycleBin,
					// ToDo: Joppe: IsUnresolved = it.
				});

			return new ItemTypeCollectionModel()
			{
				ItemType = itemTypeCollectionModels,
				Label = label
			};
		}

		public static SkosProperty DeterminePreferredLabel(IEnumerable<SkosProperty> labels)
		{
			foreach (var language in DoorzoekerConfig.Current.Languages)
			{
				var label = labels.FirstOrDefault(l => String.Equals(language, l.Language, StringComparison.OrdinalIgnoreCase));
				if (label != null)
				{
					return label;
				}
			}
			return labels.FirstOrDefault();
		}

		private static IEnumerable<StatementModel> MapStatements(IEnumerable<Statement> statements)
		{
			foreach (var statement in statements)
			{
				var objectValue = new ResourceValueModel(statement.Object.Literal);

				var newStatementModel = new StatementModel()
				{
					Object = objectValue,
					PredicateResource = new ResourceValueModel()
					{
						Link = statement.PredicateResource.Uri,
						Label = statement.PredicateResource.Value != null
							? DeterminePreferredLabel(statement.PredicateResource.Value.PrefLabel).Value
							: statement.PredicateLiteral
					},
					Statement = statement
				};

				var objectResource = statement.Object as ObjectResource;
				if (objectResource != null)
				{
					objectValue.Link = objectResource.Uri;
					objectValue.IsUnresolved = objectResource.ContentItem == null;
					if (objectResource.ContentItem != null)
					{
						objectValue.IsInRecycleBin = objectResource.ContentItem.InRecycleBin;
						objectValue.Label = DeterminePreferredLabel(objectResource.ContentItem.PrefLabel).Value;

						objectValue.Classification = DetermineClassification(objectResource.ContentItem);
					}
				}

				var objectAnnexItem = statement.Object as ObjectAnnexItem;
				if (objectAnnexItem != null)
				{
					var contentItemModel = new ContentItemModel();

					Mapper.Map(objectAnnexItem.AnnexItem, contentItemModel);

					// annex item shouldn't have an uri
					contentItemModel.Uri = null;
					contentItemModel.IsAnnexItem = true;

					newStatementModel.AnnexItemValue = contentItemModel;
				}

				yield return newStatementModel;
			}

		}

		public static ItemClassification DetermineClassification(Item item)
		{
			var contentItem = item as ContentItem;

			if (contentItem == null)
			{
				return ItemClassification.None;
			}

			return ClassifyItem(contentItem.ItemType);
		}
		
		public static ItemClassification ClassifyItem(ItemType itemType)
		{
			if (itemType == null)
			{
				return ItemClassification.None;
			}

			// walk polymorphic type hierarchy
			while (itemType != null)
			{
				if (itemType.Uri == s_bronrecord_itemtype_uri)
				{
					return ItemClassification.BronRecord;
				}

				if (itemType.Uri == s_thesaurusterm_itemtype_uri)
				{
					return ItemClassification.ThesaurusTerm;
				}

				var parent = itemType.Parent;
				// just in case we have something like simple nodes in the structure
				while (parent != null && !(parent is ItemType))
					parent = parent.Parent;

				itemType = parent as ItemType;
			}

			return ItemClassification.None;
		}
	}

}