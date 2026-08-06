using System;
using System.Net;
using System.Web.Mvc;
using AutoMapper;
using RceDoorzoeker.Models.Item;
using Trezorix.RnaRemote.Core;
using Trezorix.RnaRemote.Core.ContentItems;
using Trezorix.RnaRemote.Core.ItemTypes;
using Trezorix.RnaRemote.Core.Predicates;
using Trezorix.RnaRemote.Core.ReferenceStructures;
using Trezorix.RnaRemote.Core.SimpleNodes;
using Trezorix.RnaRemote.RepositoryBase;
using Item = Trezorix.RnaRemote.Core.Items.Item;
using ItemModel = RceDoorzoeker.Models.Item.ItemModel;

namespace RceDoorzoeker.Controllers
{
	public class ItemViewController : Controller
	{
		private readonly IItemStore _itemStore;
		
		public ItemViewController(IItemStore itemStore)
		{
			_itemStore = itemStore;
		}

		[HttpGet]
		public ActionResult Item(string uri)
		{
			if (string.IsNullOrEmpty(uri))
			{
				return new HttpStatusCodeResult(HttpStatusCode.BadRequest, "Uri parameter missing.");
			}

			var item = _itemStore.Get(uri);
			if (item == null)
			{
				return HttpNotFound();
			}

			ResourceBinder.Attach(item, _itemStore.Get);
			
			var model = InstantiateItemModel(item);
			
			Mapper.Map(item, model, sourceType: item.GetType(), destinationType: model.GetType());
			
			ViewData.Model = model;

			return View("Item");
		}

		private ItemModel InstantiateItemModel(Item item)
		{
			if (item is ContentItem)
			{
				return new ContentItemModel();
			}
			if (item is Predicate)
			{
				return new PredicateModel();
			}
			if (item is ItemType)
			{
				return new ItemTypeModel();
			}
			if (item is ReferenceStructure)
			{
				return new ReferenceStructureModel();
			}
			if (item is SimpleNode)
			{
				return new SimpleNodeModel();
			}

			throw new NotSupportedException("Unsupported model item type");
			
		}

		public ActionResult InfoWindow(string uri)
		{
			if (string.IsNullOrEmpty(uri))
			{
				return new HttpStatusCodeResult(HttpStatusCode.BadRequest, "Uri parameter missing.");
			}

			var item = _itemStore.Get(uri) as ContentItem;
			if (item == null)
			{
				return HttpNotFound();
			}

			ResourceBinder.Attach(item, _itemStore.Get);
			
			var model = new InfoWindowModel();

			Mapper.Map(item, model, sourceType: item.GetType(), destinationType: model.GetType());

			ViewData.Model = model;
			return View();
		}
	}
}
