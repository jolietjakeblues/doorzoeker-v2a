using System.Collections.Generic;

namespace RceDoorzoeker.Services.RnaApiClient.DTO
{
	public class PagedList<T>
	{
		public PageSpec PageSpec { get; set; }
		public IReadOnlyList<T> Items { get; set; }
		public int TotalCount { get; set; }
	}
}