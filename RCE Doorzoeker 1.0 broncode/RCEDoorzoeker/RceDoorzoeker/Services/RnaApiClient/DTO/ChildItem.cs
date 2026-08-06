using Trezorix.RnaRemote.Core.Items;

namespace RceDoorzoeker.Services.RnaApiClient.DTO
{
	public class ChildItem
	{
		public string Uri { get; set; }

		public SkosPropertyList PrefLabel { get; set; }

		public bool HasChildren { get; set; }

	}

}