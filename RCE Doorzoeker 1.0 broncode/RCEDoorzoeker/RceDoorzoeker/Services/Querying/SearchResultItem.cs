using System.Collections.Generic;
using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.Querying
{
	public class SearchResultItem
	{
		public IReadOnlyList<SkosProperty> Labels { get; internal set; }
		public string Name { get; internal set; }
		public string Uri { get; internal set; }
		public string ItemTypeUri { get; internal set; }
		public LatLong Coordinate { get; set; }
	}
}