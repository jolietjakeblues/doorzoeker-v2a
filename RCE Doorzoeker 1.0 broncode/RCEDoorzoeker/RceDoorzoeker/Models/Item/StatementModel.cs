using Trezorix.RnaRemote.Core.ContentItems;

namespace RceDoorzoeker.Models.Item
{
	public class StatementModel
	{
		public ResourceValueModel Object { get; set; }

		public Statement Statement { get; set; }

		public ItemModel AnnexItemValue { get; set; }

		public ResourceValueModel PredicateResource { get; set; }

		public bool IsObjectAnnexItem
		{
			get { return Statement.Object is ObjectAnnexItem; }
		}

	}
}