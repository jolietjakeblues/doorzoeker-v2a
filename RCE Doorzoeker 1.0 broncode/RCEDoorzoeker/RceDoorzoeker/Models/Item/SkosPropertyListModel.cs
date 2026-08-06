using System.Collections.Generic;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Models.Item
{
	public class SkosPropertyListModel
	{
		public IEnumerable<SkosProperty> Labels { get; set; }
		public ResourceValueModel Caption { get; set; }
	}
}