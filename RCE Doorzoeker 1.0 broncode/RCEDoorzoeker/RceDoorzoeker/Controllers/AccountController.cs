using System;
using System.Text;
using System.Web.Mvc;
using System.Web.Security;

namespace RceDoorzoeker.Controllers
{
    public class AccountController : Controller
    {
        public void Login()
        {
            // Taken from: http://blog.stevensanderson.com/2008/08/25/using-the-browsers-native-login-prompt/

            // Ensure there's a return URL
            if (Request.QueryString["ReturnUrl"] == null)
            {
                Response.Redirect(FormsAuthentication.LoginUrl + "?ReturnUrl=" + Server.UrlEncode(FormsAuthentication.DefaultUrl));
            }
            
            if (TempData.ContainsKey("allowLogin"))
            {
                // See if they've supplied credentials
                string authHeader = Request.Headers["Authorization"];
                if ((authHeader != null) && (authHeader.StartsWith("Basic")))
                {
                    // Parse username and password out of the HTTP headers
                    authHeader = authHeader.Substring("Basic".Length).Trim();
                    byte[] authHeaderBytes = Convert.FromBase64String(authHeader);
                    authHeader = Encoding.UTF7.GetString(authHeaderBytes);
                    string userName = authHeader.Split(':')[0];
                    string password = authHeader.Split(':')[1];

                    // Validate login attempt
                    if (FormsAuthentication.Authenticate(userName, password))
                    {
                        FormsAuthentication.RedirectFromLoginPage(userName, false);
                        return;
                    }
                }
            }

            // Force the browser to pop up the login prompt
            Response.StatusCode = 401;
            Response.AppendHeader("WWW-Authenticate", "Basic");
            TempData["allowLogin"] = true;

            // This gets shown if they click "Cancel" to the login prompt
            Response.Write("You must log in to access this URL.");
        }

        public RedirectResult Logout()
        {
            FormsAuthentication.SignOut();
            return Redirect(FormsAuthentication.DefaultUrl);
        }
    }
}
