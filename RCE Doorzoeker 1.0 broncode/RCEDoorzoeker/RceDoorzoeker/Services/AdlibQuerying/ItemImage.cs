using System;

namespace RceDoorzoeker.Services.AdlibQuerying
{
	public class ItemImage
	{
		public Guid ReproductionId { get; set; }

		public string MonumentNr { get; set; }

		public string Description { get; set; }
		public string Name { get; set; }

		public string BeeldbankUrl { get; set; }

		public string ThumbnailUrl
		{
			get
			{
				return string.Format("http://images.memorix.nl/rce/thumb/200x200/{0}.jpg", ReproductionId);
			}
		}
		
		public string Url
		{
			get
			{
				return string.Format("http://images.memorix.nl/rce/thumb/800x800/{0}.jpg", ReproductionId);
			}
		}
	}
}