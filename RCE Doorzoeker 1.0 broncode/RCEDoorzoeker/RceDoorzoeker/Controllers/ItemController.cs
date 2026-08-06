using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using AutoMapper;
using NLog;
using RceDoorzoeker.Configuration;
using RceDoorzoeker.Models.GroupedResults;
using RceDoorzoeker.Models.Item;
using RceDoorzoeker.Models.Search;
using RceDoorzoeker.Services;
using RceDoorzoeker.Services.AdlibQuerying;
using RceDoorzoeker.Services.Mappers;
using RceDoorzoeker.Services.Querying;
using RceDoorzoeker.Services.RnaApiClient;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote.Core.ContentItems;
using Trezorix.RnaRemote.Core.Items;
using Trezorix.RnaRemote.RepositoryBase;
using WebAPI.OutputCache;

namespace RceDoorzoeker.Controllers
{
	public class ItemController : ApiController
	{
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();

		private readonly LiteratureReferrerQueryer _textualReferrerQueryer;
		private readonly ReferrerQueryer _referrerQueryer;
		private readonly IItemStore _itemStore;
		private readonly LocalWebApiV2Client _apiV2Client;
		private readonly AdlibImageQueryer _adlibImageQueryer;
		private readonly GroupingsResultMapper _groupingsResultMapper;
		private readonly AdlibLiteratureQueryer _adlibLiteratureQueryer;
		
		public ItemController(
			LiteratureReferrerQueryer textualReferrerQueryer, 
			ReferrerQueryer referrerQueryer, 
			IItemStore itemStore, 
			LocalWebApiV2Client apiV2Client, 
			AdlibImageQueryer adlibImageQueryer, 
			AdlibLiteratureQueryer adlibLiteratureQueryer,
			GroupingsResultMapper groupingsResultMapper 
			)
		{
			_textualReferrerQueryer = textualReferrerQueryer;
			_referrerQueryer = referrerQueryer;
			_itemStore = itemStore;
			_apiV2Client = apiV2Client;
			_adlibImageQueryer = adlibImageQueryer;
			_groupingsResultMapper = groupingsResultMapper;
			_adlibLiteratureQueryer = adlibLiteratureQueryer;
		}

		[HttpGet]
		[CacheOutput(ClientTimeSpan = 72000, ServerTimeSpan = 72000 )]
		public string Thumbnail(string uri)
		{
			var item = _itemStore.Get(uri);

			if (item == null)
			{
				throw new HttpResponseException(HttpStatusCode.NotFound);
			}

			var imageResult = _adlibImageQueryer.GetPreferredImage(item);
			if (imageResult == null)
			{
				return null;
			}
			return imageResult.ThumbnailUrl;
		}

		[HttpGet]
		public ItemViewModel ItemViewData(string uri)
		{
			var item = _itemStore.Get(uri);

			if (item == null)
			{
				throw new HttpResponseException(HttpStatusCode.NotFound);
			}

			var structureNodes = AssemblePath(item);

			var children = _apiV2Client.GetChildrenPage(uri, 0, 5);

			var itemPositionModel = new ItemPositionModel
				{
					Path = ((IEnumerable<StructureNodeModel>) structureNodes).Reverse(),
					Children = children.Items.Select(c => new StructureNodeModel()
						{
							Uri = c.Uri, 
							Label = DoorzoekerModelMapper.DeterminePreferredLabel(c.PrefLabel).Value
						})
				};

			LatLong coord = null;
			if (item is ContentItem)
			{
				coord = DetermineCoordinate((ContentItem)item);
			}

			// ToDo: Joppe: Can skip determining position when classification is not ThesaurusTerm?
			var model = new ItemViewModel()
				{
					Position = itemPositionModel,
					Classification = ClassificationAsString(DoorzoekerModelMapper.DetermineClassification(item)),
					Coordinate = coord
				};

			return model;
		}

		private static List<StructureNodeModel> AssemblePath(Item item)
		{
			var structureNodes = new List<StructureNodeModel>();

			var pathItem = item;
			do
			{
				var resource = new StructureNodeModel()
					{
						Uri = pathItem.Uri,
						Label = DoorzoekerModelMapper.DeterminePreferredLabel(pathItem.PrefLabel).Value,
					};

				structureNodes.Add(resource);

				pathItem = pathItem.Parent;
			} while (pathItem != null);
			return structureNodes;
		}

		private LatLong DetermineCoordinate(ContentItem item)
		{
			var directCoord =  DetermineItemCoordinate(item);

			if (directCoord != null)
			{
				return directCoord;
			}

			// if not: does any of it's annex items have a lat/long pair?
			return item.Statements
				.Where(s => s.Object is ObjectAnnexItem)
				.Select(s => s.Object)
				.Cast<ObjectAnnexItem>()
				.Select(annex => DetermineItemCoordinate(annex.AnnexItem))
				.FirstOrDefault(coord => coord != null);
		}

		private static LatLong DetermineItemCoordinate(ContentItem item)
		{
			var coordinateUris = DoorzoekerConfig.Current.MapCoordinatePredicateUris;

			// does the item have a lat/long pair?
			var lat = item.Statements.FirstOrDefault(s => s.PredicateResource.Uri == coordinateUris.Lat);
			var @long = item.Statements.FirstOrDefault(s => s.PredicateResource.Uri == coordinateUris.Long);

			if (lat != null && @long != null)
			{
				double latDbl;
				double longDbl;

				if (Double.TryParse(lat.Object.Literal, NumberStyles.Any, CultureInfo.InvariantCulture, out latDbl) 
					&& Double.TryParse(@long.Object.Literal, NumberStyles.Any, CultureInfo.InvariantCulture, out longDbl))
				{
					return new LatLong()
						{
							Latitude = latDbl,
							Longitude = longDbl
						};
				}
			}
			return null;
		}

		private static string ClassificationAsString(ItemClassification classification)
		{
			return Enum.GetName(typeof(ItemClassification), classification).ToLowerInvariant();
		}

		[HttpGet]
		public ChildrenResultModel Children(string uri, int start = 0, int count = 20)
		{
			var result = _apiV2Client.GetChildrenPage(uri, start, count);

			var resultModel = new ChildrenResultModel();

			Mapper.Map(result, resultModel);

			return resultModel;
		}

		[HttpGet]
		public PagedList<ItemImage> ListImages(string uri, int start = 0, int count = 10)
		{
			var item = _itemStore.Get(uri);
			if (item == null)
			{
				throw new HttpResponseException(HttpStatusCode.NotFound);
			}

			var imagesResult = _adlibImageQueryer.ListImages(item, start, count);
			return imagesResult;
		}

		[HttpGet]
		public PagedList<ItemLiterature> ListLiterature(string uri, int start = 0, int count = 10)
		{
			var item = _itemStore.Get(uri);
			if (item == null)
			{
				throw new HttpResponseException(HttpStatusCode.NotFound);
			}

			var imagesResult = _adlibLiteratureQueryer.ListLiterature(item, start, count);
			return imagesResult;
		}

		[HttpGet]
		public List<GroupingResultModel> ListReferrerGroupings(string uri)
		{
			// query referrers and add to ItemModel.Referrers
			var referrerQueryResult = _referrerQueryer.QueryGroupings(uri);

			var referrerGroupingsModel = _groupingsResultMapper.MapGroupsResult(referrerQueryResult).ToList();

			return referrerGroupingsModel;
		}

		[HttpGet]
		public GroupingItemsModel ListGroupingReferrers(string uri, string groupingUri, int start, int count)
		{
			var items = _referrerQueryer.QueryGroupingItems(uri, groupingUri, start, count); 

			var model = new GroupingItemsModel();

			Mapper.Map(items, model);

			return model;
		}

		[HttpGet]
		public ClusteredMapResultModel ReferrerMap([FromUri] ViewportReferrersSpec searchSpec)
		{
			if (searchSpec.BottomRight == null || searchSpec.TopLeft == null)
			{
				var message = new HttpResponseMessage(HttpStatusCode.BadRequest)
				{
					ReasonPhrase = "Missing view port parameters TopLeft and/or BottomRight"
				};
				throw new HttpResponseException(message);
			}

			// ToDo: Move code into queryer service

			const int map_view_pixel_height = 500;

			double latLongPerPixel = LatLongHelper.CalcLatLongPerPixel(map_view_pixel_height, searchSpec.TopLeft, searchSpec.BottomRight);

			var sw = new Stopwatch();
			sw.Start();

			var result = _referrerQueryer.QueryMap(searchSpec.Uri, searchSpec.TopLeft, searchSpec.BottomRight, latLongPerPixel);
			
			double timingPerItem = 0;
			double itemsPerSec = 0;
			if (result.TotalCount > 0)
			{
				timingPerItem = (Double)sw.ElapsedMilliseconds / result.TotalCount;
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
		public List<GroupingResultModel> ListTextualReferrerGroupings(string uri)
		{
			var item = _itemStore.Get(uri);
			if (item == null)
			{
				throw new HttpResponseException(HttpStatusCode.NotFound);
			}

			// query referrers and add to ItemModel.Referrers
			var referrerQueryResult = _textualReferrerQueryer.QueryGroupings(item);
			
			var referrerGroupingsModel = _groupingsResultMapper.MapGroupsResult(referrerQueryResult).ToList();

			return referrerGroupingsModel;
		}

		[HttpGet]
		public GroupingItemsModel ListGroupingTextualReferrers(string uri, string groupingUri, int start, int count)
		{
			var item = _itemStore.Get(uri);
			if (item == null)
			{
				throw new HttpResponseException(HttpStatusCode.NotFound);
			}

			var items = _textualReferrerQueryer.QueryGroupingItems(item, groupingUri, start, count);

			var model = new GroupingItemsModel();

			Mapper.Map(items, model);

			return model;
		}
	}

	public class ViewportReferrersSpec
	{
		public string Uri { get; set; }
		public LatLong TopLeft { get; set; }
		public LatLong BottomRight { get; set; }
	}
}
