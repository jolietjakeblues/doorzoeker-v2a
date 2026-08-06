using System.Web.Mvc;
using NLog;

namespace RceDoorzoeker.Controllers
{
	public class HomeController : Controller
	{
		//
		// GET: /Home/
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();

		// disable caching altogether, app entry point caching gives problems with Chrome a lot. Browser application will always phone home during startup.
		[OutputCache(VaryByParam = "*", Duration = 0, NoStore = true)]
		public ActionResult Home()
		{
			s_logger.Info("Home request.");
			
			return View();
		}

	}

}
