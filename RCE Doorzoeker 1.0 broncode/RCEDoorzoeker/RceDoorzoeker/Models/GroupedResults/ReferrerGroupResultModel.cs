using System.Collections.Generic;
using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Models.GroupedResults
{
	public class ReferrerGroupResultModel : GroupingResultModel
	{
		public bool ShowMoreLink { get; set; }
		public IEnumerable<ResultItemGroup> Items { get; set; }
		public string MoreLink { get; set; }
	}
}