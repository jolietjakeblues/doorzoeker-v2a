using System.Web.Http.Filters;
using NLog;

namespace RceDoorzoeker
{
	public class ErrorLoggingAttribute : ExceptionFilterAttribute
	{
		private static readonly Logger s_logger = LogManager.GetCurrentClassLogger();

		public override void OnException(HttpActionExecutedContext actionExecutedContext)
		{
			s_logger.Fatal(actionExecutedContext.Exception.ToString());
			// ToDo: This doesn't seem to work...
			LogManager.Flush();
			
		}
	}
}