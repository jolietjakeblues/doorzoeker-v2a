namespace RceDoorzoeker.Models.Search
{
	public class SearchGroupingsSpec : SearchSpec
	{
		public SearchGroupingsSpec()
		{
			MaxGroups = 75;
		}

		public int MaxGroups { get; set; }		
		
	}
}