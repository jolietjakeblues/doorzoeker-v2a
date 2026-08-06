using System.Web.Http;
using System.Web.Mvc;

namespace RceDoorzoeker
{
	public class FilterConfig
	{
		public static void RegisterGlobalFilters(GlobalFilterCollection filters)
		{
			GlobalConfiguration.Configuration.Filters.Add(new ErrorLoggingAttribute());
		}
	}
}