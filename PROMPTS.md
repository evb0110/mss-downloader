Handle all the todos in turn. You should be aware that they may be notoriously difficult.
Dealing with each todo, you should use ultrahard thinking to make a 
detailed plan, split analysis task and spawn 5 parallel agents to deal with analyzing the curls 
and the reasons of problems, but be careful to orchestrate them properly and take into account 
their findings. When determining logic of downloading manifest and pages, you should test this 
logic by downloading several of those pages and checking if they contain real fullsize images. 
Only then should you apply all the other logic. Only when the task is 100% done, you can start the
next one. Only when you are 100% sure that all the tasks are done, you should bump the version, 
commit and push. After that you should wait until the build is successful. Also ensure that user 
receives right changelog, containing non-tecnical review of fixes and additions of new libraries, 
not a generic or technical one. 
**TOP PRIORITIES:**
- You should ensure that we don't ship broken code. 
- You should not prioritize on using less tokens (we don't mind paying more) or on speed (we have plenty of time). 
- Our priority is stable robust working code and best ux.