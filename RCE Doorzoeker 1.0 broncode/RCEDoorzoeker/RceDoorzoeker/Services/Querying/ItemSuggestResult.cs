using System.Collections.Generic;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.Querying
{
	public class ItemSuggestResult
	{
		public List<SkosProperty> PrefLabels { get; set; }
		public List<SkosProperty> AltLabels { get; set; }
		public string Uri { get; set; }
		public string Name { get; set; }
		public string ItemTypeUri { get; set; }
		
	}
}