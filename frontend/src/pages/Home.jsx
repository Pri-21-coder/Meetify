import React from "react";
import withAuth from "../utlis/withAuth";
//this component not accesible by everyone Authenticate user can access this
function HomeComponent(){
    return (
        <div>HomeComponent</div>
    )
}

export default withAuth(HomeComponent)