using System.Collections.Generic;

namespace RceDoorzoeker.Models.GroupedResults
{
	public class ReferrerResultModel
	{
		public IEnumerable<ReferrerGroupResultModel> ReferrerGroups { get; set; }
		public int TotalReferrerCount { get; set; }
		public int Start { get; set; }
	}
}