using AutoMapper;
using RceDoorzoeker.Models.Item;
using RceDoorzoeker.Services.Querying;
using Trezorix.RnaRemote.Core.ItemTypes;

namespace RceDoorzoeker.Services.Mappers
{
	public class SearchResultItemClassificationResolver : ValueResolver<SearchResultItem, ItemClassification>
	{
		private readonly IItemTypeRepository _itemTypeRepository;

		public SearchResultItemClassificationResolver(IItemTypeRepository itemTypeRepository)
		{
			_itemTypeRepository = itemTypeRepository;
		}

		protected override ItemClassification ResolveCore(SearchResultItem source)
		{
			if (source.ItemTypeUri == null) return ItemClassification.None;
			
			var itemType = _itemTypeRepository.Get(source.ItemTypeUri);

			if (itemType == null) return ItemClassification.None;

			return DoorzoekerModelMapper.ClassifyItem(itemType);
		}
	}
}