using System.Reflection;
using System.Web.Http;
using System.Web.Mvc;
using RceDoorzoeker;
using SimpleInjector;
using SimpleInjector.Integration.Web.Mvc;

[assembly: WebActivator.PostApplicationStartMethod(typeof(SimpleInjectorInitializer), "Initialize")]

namespace RceDoorzoeker
{
	public static class SimpleInjectorInitializer
	{
		/// <summary>Initialize the container and register it as MVC3 Dependency Resolver.</summary>
		public static void Initialize()
		{
			// Did you know the container can diagnose your configuration? Go to: http://bit.ly/YE8OJj.
			var container = new Container();
			
			Bootstrapper.RegisterServices(container);

			container.RegisterMvcControllers(Assembly.GetExecutingAssembly());
			
			container.RegisterMvcAttributeFilterProvider();
			
			container.Verify();

			DependencyResolver.SetResolver(new SimpleInjectorDependencyResolver(container));

			GlobalConfiguration.Configuration.DependencyResolver = new SimpleInjectorWebApiDependencyResolver(container);
			
		}
	}
}