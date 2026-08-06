using System.Collections.Generic;

namespace RceDoorzoeker.Services.Querying
{
	public class ResultItemGroup
	{
		public ResultItemGroup(string rootUri, IList<SearchResultItem> items)
		{
			RootUri = rootUri;

			Items = (IReadOnlyList<SearchResultItem>) items;
		}

		public string RootUri { get; internal set; }
		public IReadOnlyList<SearchResultItem> Items { get; internal set; }
		public int TotalItemCount { get; internal set; }
	}
}