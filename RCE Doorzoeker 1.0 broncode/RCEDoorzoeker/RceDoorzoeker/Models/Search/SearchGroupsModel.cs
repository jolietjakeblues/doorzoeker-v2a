using System.Collections.Generic;
using RceDoorzoeker.Models.GroupedResults;

namespace RceDoorzoeker.Models.Search
{
	public class SearchGroupsModel
	{
		public string Query { get; set; }
		public IReadOnlyList<GroupingResultModel> Groups { get; set; }
		
	}
}