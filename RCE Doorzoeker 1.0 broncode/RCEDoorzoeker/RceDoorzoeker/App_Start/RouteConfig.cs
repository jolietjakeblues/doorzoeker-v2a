using System.Web.Mvc;
using System.Web.Routing;

namespace RceDoorzoeker
{
	public class RouteConfig
	{
		public static void RegisterRoutes(RouteCollection routes)
		{
			routes.MapRoute(
				name: "Item detail view",
				url: "ItemView",
				defaults: new
					{
						controller = "ItemView",
						action = "Item"
					}
				);

			routes.MapRoute(
				name: "InfoWindow content",
				url: "infowindow",
				defaults: new
					{
						controller = "ItemView",
						action = "InfoWindow"
					}
				);

			routes.MapRoute(
				name: "Admin",
				url: "Admin/{action}/{id}",
				defaults: new
					{
						controller = "Admin",
						action = "Index",
						id = UrlParameter.Optional
					}
				);

			routes.MapRoute(
				name: "Account",
				url: "Account/{action}/{id}",
				defaults: new
				{
					controller = "Account",
					action = "Login",
					id = UrlParameter.Optional
				}
			);

			routes.MapRoute(
				name: "Default",
				url: "{controller}/{action}/{id}",
				defaults: new
					{
						controller = "Home",
						action = "Home",
						id = UrlParameter.Optional
					}
				);
		}
	}
}