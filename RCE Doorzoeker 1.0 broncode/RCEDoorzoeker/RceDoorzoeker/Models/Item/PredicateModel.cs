namespace RceDoorzoeker.Models.Item
{
	public class PredicateModel : ItemModel
	{
		public ResourceValueModel InverseResource { get; set; }

		public ItemTypeCollectionModel Range { get; set; }

		public ItemTypeCollectionModel Domain { get; set; }
		
	}
}