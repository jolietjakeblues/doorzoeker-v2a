using SimpleInjector;

namespace RceDoorzoeker.Util
{
	public static class SimpleInjectorInitializer
	{
		/// <summary>Initialize the container and register it as MVC3 Dependency Resolver.</summary>
		public static Container Initialize()
		{
			// Did you know the container can diagnose your configuration? Go to: http://bit.ly/YE8OJj.
			var container = new Container();
			
			Bootstrapper.RegisterServices(container);

			container.Verify();

			return container;
		}
	 	
	}
}