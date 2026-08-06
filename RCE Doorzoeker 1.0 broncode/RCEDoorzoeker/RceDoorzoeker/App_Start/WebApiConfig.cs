using System.Web.Http;

namespace RceDoorzoeker
{
	public static class WebApiConfig
	{
		public static void Register(HttpConfiguration config)
		{
			config.Routes.MapHttpRoute(
				  name: "SearchApi",
				  routeTemplate: "search/{action}",
				  defaults: new { controller = "Search" }
			);

			config.Routes.MapHttpRoute(
				  name: "ItemApi",
				  routeTemplate: "item/{action}",
				  defaults: new { controller = "item" }
			);

			config.Routes.MapHttpRoute(
				  name: "ThesaurusApi",
				  routeTemplate: "thesaurus/{action}",
				  defaults: new { controller = "thesaurus" }
			);
			
		}
	}
}